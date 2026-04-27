import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  canTransitionOfferingStatus,
  OFFERING_STATUS,
} from "@/lib/offering-status";
import {
  isSlotOptionalCourse,
  SCHEDULE_CONFLICT_STATUSES,
} from "@/lib/course-schedule-policy";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function timeToMinutes(value: string) {
  const [h, m] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function hasTimeOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);

  if (aS === null || aE === null || bS === null || bE === null) return false;
  return aS < bE && bS < aE;
}

type ValidationEvent = {
  offeredCourseId: number;
  courseCode: string;
  section: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomId: number | null;
  roomCode: string;
  batchIds: number[];
  batchCodes: string[];
  teacherIds: number[];
  teacherCodes: string[];
};

function eventLabel(event: ValidationEvent) {
  return `${event.courseCode} Sec-${event.section} (${event.dayOfWeek} ${event.startTime}-${event.endTime})`;
}

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();
    const offeringId = Number(body?.offeringId);
    const targetStatus = normalizeText(body?.targetStatus);

    if (!offeringId) {
      return NextResponse.json(
        { ok: false, error: "Valid offeringId is required." },
        { status: 400 }
      );
    }

    if (!targetStatus) {
      return NextResponse.json(
        { ok: false, error: "targetStatus is required." },
        { status: 400 }
      );
    }

    const offering = await prisma.offerings.findFirst({
      where: { id: offeringId },
      include: {
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_batches: {
              include: {
                batches: true,
              },
            },
            offered_course_slots: {
              include: {
                rooms: true,
              },
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
            },
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
            primary_offered_course: {
              include: {
                master_courses: true,
                offered_course_slots: {
                  include: {
                    rooms: true,
                  },
                  orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
                },
                offered_course_teachers: {
                  include: {
                    teachers: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json(
        { ok: false, error: "Offering not found." },
        { status: 404 }
      );
    }

    if (!canTransitionOfferingStatus(offering.status, targetStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid lifecycle transition from ${offering.status} to ${targetStatus}.`,
        },
        { status: 400 }
      );
    }

    const blockers: string[] = [];

    if (targetStatus === OFFERING_STATUS.BUFFER_READY) {
      if (offering.offered_courses.length === 0) {
        blockers.push("Cannot move empty offering to BUFFER_READY.");
      }

      for (const course of offering.offered_courses) {
        const isPrimary = !course.primary_offered_course_id;

        const slotOptional = isSlotOptionalCourse({
          course_code: course.master_courses.course_code,
          course_title: course.master_courses.course_title,
          course_type: course.master_courses.course_type,
        });

        if (course.offered_course_batches.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no batch assigned.`
          );
        }

        if (!isPrimary) continue;

        if (!slotOptional && course.offered_course_slots.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no meeting slot assigned.`
          );
        }
      }
    }

    if (targetStatus === OFFERING_STATUS.CONFIRMED) {
      const events: ValidationEvent[] = [];

      for (const course of offering.offered_courses) {
        const isPrimary = !course.primary_offered_course_id;

        const effectiveSlots =
          course.primary_offered_course_id &&
          course.primary_offered_course?.offered_course_slots.length
            ? course.primary_offered_course.offered_course_slots
            : course.offered_course_slots;

        const effectiveTeachers =
          course.primary_offered_course_id &&
          course.primary_offered_course?.offered_course_teachers.length
            ? course.primary_offered_course.offered_course_teachers
            : course.offered_course_teachers;

        const slotOptional = isSlotOptionalCourse({
          course_code: course.master_courses.course_code,
          course_title: course.master_courses.course_title,
          course_type: course.master_courses.course_type,
        });

        if (course.offered_course_batches.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no batch assigned.`
          );
        }

        if (isPrimary && !slotOptional && effectiveSlots.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no meeting slot assigned.`
          );
        }

        if (isPrimary && effectiveTeachers.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no faculty assigned in offered_course_teachers.`
          );
        }

        if (isPrimary && effectiveTeachers.length > 1) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: multiple faculty assignments found. Keep one official assignment before confirmation.`
          );
        }

        const inactiveAssignedTeacher = effectiveTeachers.find(
          (row) => !row.teachers.is_active
        );

        if (inactiveAssignedTeacher) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: assigned faculty ${inactiveAssignedTeacher.teachers.teacher_code} is inactive.`
          );
        }

        for (const slot of effectiveSlots) {
          events.push({
            offeredCourseId: course.id,
            courseCode: course.master_courses.course_code,
            section: course.section,
            dayOfWeek: slot.day_of_week,
            startTime: slot.start_time,
            endTime: slot.end_time,
            roomId: slot.room_id,
            roomCode: slot.rooms?.room_code || "-",
            batchIds: course.offered_course_batches.map((row) => row.batch_id),
            batchCodes: course.offered_course_batches.map(
              (row) => row.batches.batch_code
            ),
            teacherIds: effectiveTeachers.map((row) => row.teacher_id),
            teacherCodes: effectiveTeachers.map(
              (row) => row.teachers.teacher_code
            ),
          });
        }
      }

      for (let i = 0; i < events.length; i += 1) {
        for (let j = i + 1; j < events.length; j += 1) {
          const a = events[i];
          const b = events[j];

          if (a.dayOfWeek !== b.dayOfWeek) continue;

          if (!hasTimeOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
            continue;
          }

          if (
            a.roomId &&
            b.roomId &&
            a.roomId === b.roomId &&
            a.offeredCourseId !== b.offeredCourseId
          ) {
            blockers.push(
              `Room conflict: ${a.roomCode} is used by ${eventLabel(
                a
              )} and ${eventLabel(b)}.`
            );
          }

          const sharedBatchCodes = a.batchCodes.filter((code) =>
            b.batchCodes.includes(code)
          );

          if (
            sharedBatchCodes.length > 0 &&
            a.offeredCourseId !== b.offeredCourseId
          ) {
            blockers.push(
              `Batch conflict for ${sharedBatchCodes.join(", ")}: ${eventLabel(
                a
              )} overlaps with ${eventLabel(b)}.`
            );
          }

          const sharedTeacherCodes = a.teacherCodes.filter((code) =>
            b.teacherCodes.includes(code)
          );

          if (
            sharedTeacherCodes.length > 0 &&
            a.offeredCourseId !== b.offeredCourseId
          ) {
            blockers.push(
              `Faculty conflict for ${sharedTeacherCodes.join(
                ", "
              )}: ${eventLabel(a)} overlaps with ${eventLabel(b)}.`
            );
          }
        }
      }

      const externalSlots = await prisma.offered_course_slots.findMany({
        where: {
          offered_courses: {
            offering_id: {
              not: offering.id,
            },
            offerings: {
              academic_term_id: offering.academic_term_id,
              status: {
                in: SCHEDULE_CONFLICT_STATUSES,
              },
            },
          },
        },
        include: {
          rooms: true,
          offered_courses: {
            include: {
              master_courses: true,
              offered_course_batches: {
                include: {
                  batches: true,
                },
              },
              offered_course_teachers: {
                include: {
                  teachers: true,
                },
              },
              primary_offered_course: {
                include: {
                  offered_course_teachers: {
                    include: {
                      teachers: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (const event of events) {
        for (const external of externalSlots) {
          if (event.dayOfWeek !== external.day_of_week) continue;

          if (
            !hasTimeOverlap(
              event.startTime,
              event.endTime,
              external.start_time,
              external.end_time
            )
          ) {
            continue;
          }

          const externalCourse = external.offered_courses;
          const externalTeacherRows =
            externalCourse.primary_offered_course?.offered_course_teachers
              ?.length
              ? externalCourse.primary_offered_course.offered_course_teachers
              : externalCourse.offered_course_teachers;

          const externalBatchCodes = externalCourse.offered_course_batches.map(
            (row) => row.batches.batch_code
          );

          const externalTeacherCodes = externalTeacherRows.map(
            (row) => row.teachers.teacher_code
          );

          const externalLabel = `${externalCourse.master_courses.course_code} Sec-${externalCourse.section} (${external.day_of_week} ${external.start_time}-${external.end_time})`;

          if (event.roomId && event.roomId === external.room_id) {
            blockers.push(
              `Room conflict with another offering: ${event.roomCode} is used by ${eventLabel(
                event
              )} and ${externalLabel}.`
            );
          }

          const sharedBatchCodes = event.batchCodes.filter((code) =>
            externalBatchCodes.includes(code)
          );

          if (sharedBatchCodes.length > 0) {
            blockers.push(
              `Batch conflict with another offering for ${sharedBatchCodes.join(
                ", "
              )}: ${eventLabel(event)} overlaps with ${externalLabel}.`
            );
          }

          const sharedTeacherCodes = event.teacherCodes.filter((code) =>
            externalTeacherCodes.includes(code)
          );

          if (sharedTeacherCodes.length > 0) {
            blockers.push(
              `Faculty conflict with another offering for ${sharedTeacherCodes.join(
                ", "
              )}: ${eventLabel(event)} overlaps with ${externalLabel}.`
            );
          }
        }
      }
    }

    const uniqueBlockers = Array.from(new Set(blockers));

    if (uniqueBlockers.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Transition to ${targetStatus} blocked.`,
          blockers: uniqueBlockers,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.offerings.update({
      where: { id: offeringId },
      data: { status: targetStatus },
      select: {
        id: true,
        status: true,
      },
    });

    clearReportingCacheWithLog("offering status changed");

    return NextResponse.json({
      ok: true,
      message: `Offering moved to ${updated.status}.`,
      offering: updated,
    });
  } catch (error) {
    console.error("Offering status transition failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to change offering status.",
      },
      { status: 500 }
    );
  }
}
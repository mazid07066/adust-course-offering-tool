import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";
import { SCHEDULE_CONFLICT_STATUSES } from "@/lib/course-schedule-policy";

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function timeToMinutes(value: string) {
  const [hour, minute] = String(value || "00:00")
    .split(":")
    .map((part) => Number(part));

  return hour * 60 + minute;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return (
    timeToMinutes(aStart) < timeToMinutes(bEnd) &&
    timeToMinutes(aEnd) > timeToMinutes(bStart)
  );
}

async function getSectionGroupCourseIds(offeredCourseId: number) {
  const course = await prisma.offered_courses.findUnique({
    where: { id: offeredCourseId },
    select: {
      id: true,
      primary_offered_course_id: true,
    },
  });

  if (!course) return [offeredCourseId];

  const primaryId = course.primary_offered_course_id || course.id;

  const courses = await prisma.offered_courses.findMany({
    where: {
      OR: [{ id: primaryId }, { primary_offered_course_id: primaryId }],
    },
    select: {
      id: true,
    },
  });

  return courses.map((item) => item.id);
}

async function assertOfferingEditable(offeredCourseId: number) {
  const course = await prisma.offered_courses.findUnique({
    where: { id: offeredCourseId },
    include: {
      offerings: true,
      master_courses: true,
    },
  });

  if (!course) {
    throw new Error("Offered course not found.");
  }

  if (course.offerings.status === "CONFIRMED") {
    throw new Error("This offering is already CONFIRMED. Editing is blocked.");
  }

  return course;
}

async function validateRoomAndBatch(params: {
  offeredCourseId: number;
  slotId?: number;
  roomId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}) {
  const sectionGroupCourseIds = await getSectionGroupCourseIds(params.offeredCourseId);

  const courseBatchIds = await prisma.offered_course_batches.findMany({
    where: {
      offered_course_id: {
        in: sectionGroupCourseIds,
      },
    },
    select: {
      batch_id: true,
    },
  });

  const batchIds = courseBatchIds.map((item) => item.batch_id);

  const roomConflict = await prisma.offered_course_slots.findFirst({
    where: {
      room_id: params.roomId,
      day_of_week: params.dayOfWeek,
      ...(params.slotId ? { id: { not: params.slotId } } : {}),
      start_time: {
        lt: params.endTime,
      },
      end_time: {
        gt: params.startTime,
      },
      offered_course_id: {
        notIn: sectionGroupCourseIds,
      },
      offered_courses: {
        offerings: {
          status: {
            in: SCHEDULE_CONFLICT_STATUSES,
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (roomConflict) {
    throw new Error("Selected room is not available for this day/time.");
  }

  const batchConflict = await prisma.offered_course_slots.findFirst({
    where: {
      day_of_week: params.dayOfWeek,
      ...(params.slotId ? { id: { not: params.slotId } } : {}),
      start_time: {
        lt: params.endTime,
      },
      end_time: {
        gt: params.startTime,
      },
      offered_course_id: {
        notIn: sectionGroupCourseIds,
      },
      offered_courses: {
        offerings: {
          status: {
            in: SCHEDULE_CONFLICT_STATUSES,
          },
        },
        offered_course_batches: {
          some: {
            batch_id: {
              in: batchIds,
            },
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (batchConflict) {
    throw new Error("Selected day/time creates a batch conflict.");
  }
}

async function validateFaculty(params: {
  offeredCourseId: number;
  teacherId: number;
}) {
  const sectionGroupCourseIds = await getSectionGroupCourseIds(params.offeredCourseId);

  const ownSlots = await prisma.offered_course_slots.findMany({
    where: {
      offered_course_id: {
        in: sectionGroupCourseIds,
      },
    },
  });

  if (ownSlots.length === 0) {
    return;
  }

  const otherAssignments = await prisma.offered_course_teachers.findMany({
    where: {
      teacher_id: params.teacherId,
      offered_course_id: {
        notIn: sectionGroupCourseIds,
      },
      offered_courses: {
        offerings: {
          status: {
            in: SCHEDULE_CONFLICT_STATUSES,
          },
        },
      },
    },
    include: {
      offered_courses: {
        include: {
          offered_course_slots: true,
        },
      },
    },
  });

  for (const ownSlot of ownSlots) {
    for (const assignment of otherAssignments) {
      for (const otherSlot of assignment.offered_courses.offered_course_slots) {
        if (ownSlot.day_of_week !== otherSlot.day_of_week) continue;

        if (
          overlaps(
            ownSlot.start_time,
            ownSlot.end_time,
            otherSlot.start_time,
            otherSlot.end_time
          )
        ) {
          throw new Error("Selected faculty is not available for this schedule.");
        }
      }
    }
  }
}

function inferSlotType(durationMinutes: number) {
  if (durationMinutes >= 120) return "LAB";
  return "CLASS";
}

export async function PATCH(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();
    const action = normalizeText(body.action);

    if (action === "UPSERT_SLOT") {
      const offeredCourseId = Number(body.offeredCourseId);
      const slotId = Number(body.slotId || 0);
      const dayOfWeek = normalizeText(body.dayOfWeek);
      const startTime = String(body.startTime || "").trim();
      const endTime = String(body.endTime || "").trim();
      const roomId = Number(body.roomId);

      if (!offeredCourseId || !dayOfWeek || !startTime || !endTime || !roomId) {
        return NextResponse.json(
          { ok: false, error: "Slot data is incomplete." },
          { status: 400 }
        );
      }

      const course = await assertOfferingEditable(offeredCourseId);

      await validateRoomAndBatch({
        offeredCourseId,
        slotId: slotId || undefined,
        roomId,
        dayOfWeek,
        startTime,
        endTime,
      });

      const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);

      if (durationMinutes <= 0) {
        return NextResponse.json(
          { ok: false, error: "End time must be later than start time." },
          { status: 400 }
        );
      }

      const data = {
        offered_course_id: offeredCourseId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room_id: roomId,
        slot_type: inferSlotType(durationMinutes),
      };

      const savedSlot = slotId
        ? await prisma.offered_course_slots.update({
            where: {
              id: slotId,
            },
            data,
            select: {
              id: true,
            },
          })
        : await prisma.offered_course_slots.create({
            data,
            select: {
              id: true,
            },
          });

      clearReportingCacheWithLog("schedule-control slot changed");

      return NextResponse.json({
        ok: true,
        message: `${course.master_courses.course_code} slot saved successfully.`,
        slotId: savedSlot.id,
      });
    }

    if (action === "ASSIGN_FACULTY") {
      const offeredCourseId = Number(body.offeredCourseId);
      const teacherId = Number(body.teacherId);

      if (!offeredCourseId || !teacherId) {
        return NextResponse.json(
          { ok: false, error: "offeredCourseId and teacherId are required." },
          { status: 400 }
        );
      }

      const course = await assertOfferingEditable(offeredCourseId);

      const teacher = await prisma.teachers.findUnique({
        where: {
          id: teacherId,
        },
      });

      if (!teacher || teacher.is_active === false) {
        return NextResponse.json(
          { ok: false, error: "Selected faculty is invalid or inactive." },
          { status: 400 }
        );
      }

      await validateFaculty({
        offeredCourseId,
        teacherId,
      });

      await prisma.$transaction(async (tx) => {
        await tx.offered_course_teachers.deleteMany({
          where: {
            offered_course_id: offeredCourseId,
          },
        });

        await tx.offered_course_teachers.create({
          data: {
            offered_course_id: offeredCourseId,
            teacher_id: teacherId,
            assigned_credit: course.master_courses.credit || 0,
            load_type: course.master_courses.course_type?.toUpperCase().includes("LAB")
              ? "LAB"
              : course.master_courses.course_title.toUpperCase().includes("PROJECT") ||
                  course.master_courses.course_title.toUpperCase().includes("FYDP")
                ? "PROJECT"
                : "THEORY",
          },
        });
      });

      clearReportingCacheWithLog("schedule-control faculty changed");

      return NextResponse.json({
        ok: true,
        message: `${course.master_courses.course_code} faculty assignment updated.`,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported action." },
      { status: 400 }
    );
  } catch (error) {
    clearReportingCacheWithLog("schedule-control change failed");

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to apply schedule control update.",
      },
      { status: 500 }
    );
  }
}
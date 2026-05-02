import { prisma } from "@/lib/prisma";
import { SCHEDULE_CONFLICT_STATUSES } from "@/lib/course-schedule-policy";

export type ScheduleConflictType =
  | "ROOM_CONFLICT"
  | "BATCH_CONFLICT"
  | "FACULTY_CONFLICT";

export type ScheduleConflictItem = {
  type: ScheduleConflictType;
  severity: "BLOCKER";
  termName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  conflictWithStartTime: string;
  conflictWithEndTime: string;
  roomCode: string;
  batchCodes: string[];
  teacherCodes: string[];
  first: {
    offeringId: number;
    offeredCourseId: number;
    programCode: string;
    courseCode: string;
    courseTitle: string;
    section: string;
    status: string;
  };
  second: {
    offeringId: number;
    offeredCourseId: number;
    programCode: string;
    courseCode: string;
    courseTitle: string;
    section: string;
    status: string;
  };
};

type OperationalGroup = {
  groupId: number;
  offeringId: number;
  termName: string;
  programCode: string;
  status: string;
  offeredCourseId: number;
  courseCode: string;
  courseTitle: string;
  section: string;
  slots: {
    id: number;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    roomId: number;
    roomCode: string;
  }[];
  batchCodes: string[];
  teacherCodes: string[];
};

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

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function intersection(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function label(group: OperationalGroup) {
  return {
    offeringId: group.offeringId,
    offeredCourseId: group.offeredCourseId,
    programCode: group.programCode,
    courseCode: group.courseCode,
    courseTitle: group.courseTitle,
    section: group.section,
    status: group.status,
  };
}

export async function scanScheduleConflicts(options: {
  termName?: string;
  termId?: number;
  offeringId?: number;
}) {
  const term =
    options.termId || options.termName
      ? await prisma.academic_terms.findFirst({
          where: {
            ...(options.termId ? { id: options.termId } : {}),
            ...(options.termName
              ? {
                  name: String(options.termName).trim().toUpperCase(),
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
          },
        })
      : null;

  if ((options.termId || options.termName) && !term) {
    return {
      ok: false,
      error: "Academic term not found.",
      conflicts: [] as ScheduleConflictItem[],
      summary: {
        total: 0,
        roomConflicts: 0,
        batchConflicts: 0,
        facultyConflicts: 0,
      },
    };
  }

  /*
    IMPORTANT:
    We scan only PRIMARY operational sections.

    If a course is secondary co-offered:
    - its old/imported slots are ignored for conflict checking
    - it inherits primary slot/faculty
    - its batches are added to the primary operational group

    This prevents false conflicts after co-offering.
  */
  const primaryCourses = await prisma.offered_courses.findMany({
    where: {
      primary_offered_course_id: null,
      ...(options.offeringId
        ? {
            OR: [
              { offering_id: options.offeringId },
              {
                secondary_offered_courses: {
                  some: {
                    offering_id: options.offeringId,
                  },
                },
              },
            ],
          }
        : {}),
      offerings: {
        ...(term?.id ? { academic_term_id: term.id } : {}),
        status: {
          in: SCHEDULE_CONFLICT_STATUSES,
        },
      },
    },
    include: {
      offerings: {
        include: {
          academic_terms: true,
          programs: true,
        },
      },
      master_courses: true,
      offered_course_slots: {
        include: {
          rooms: true,
        },
      },
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
      secondary_offered_courses: {
        include: {
          offerings: {
            include: {
              programs: true,
              academic_terms: true,
            },
          },
          master_courses: true,
          offered_course_batches: {
            include: {
              batches: true,
            },
          },
        },
      },
    },
    orderBy: [{ offering_id: "asc" }, { id: "asc" }],
  });

  const groups: OperationalGroup[] = primaryCourses
    .filter((course) => course.offered_course_slots.length > 0)
    .map((course) => {
      const primaryBatches = course.offered_course_batches.map(
        (row) => row.batches.batch_code
      );

      const secondaryBatches = course.secondary_offered_courses.flatMap(
        (secondary) =>
          secondary.offered_course_batches.map((row) => row.batches.batch_code)
      );

      return {
        groupId: course.id,
        offeringId: course.offering_id,
        termName: course.offerings.academic_terms.name,
        programCode: course.offerings.programs.short_name,
        status: course.offerings.status,
        offeredCourseId: course.id,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        section: course.section,
        slots: course.offered_course_slots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          roomId: slot.room_id,
          roomCode: slot.rooms?.room_code || "-",
        })),
        batchCodes: unique([...primaryBatches, ...secondaryBatches]),
        teacherCodes: unique(
          course.offered_course_teachers.map(
            (row) => row.teachers.teacher_code
          )
        ),
      };
    });

  const conflicts: ScheduleConflictItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < groups.length; i += 1) {
    const first = groups[i];

    for (let j = i + 1; j < groups.length; j += 1) {
      const second = groups[j];

      if (first.groupId === second.groupId) continue;

      for (const firstSlot of first.slots) {
        for (const secondSlot of second.slots) {
          if (firstSlot.dayOfWeek !== secondSlot.dayOfWeek) continue;

          if (
            !overlaps(
              firstSlot.startTime,
              firstSlot.endTime,
              secondSlot.startTime,
              secondSlot.endTime
            )
          ) {
            continue;
          }

          const sameRoom = firstSlot.roomId === secondSlot.roomId;
          const commonBatches = intersection(first.batchCodes, second.batchCodes);
          const commonTeachers = intersection(
            first.teacherCodes,
            second.teacherCodes
          );

          const pushConflict = (
            type: ScheduleConflictType,
            batchCodes: string[],
            teacherCodes: string[]
          ) => {
            const key = [
              type,
              first.groupId,
              second.groupId,
              firstSlot.id,
              secondSlot.id,
              batchCodes.join(","),
              teacherCodes.join(","),
            ].join("|");

            if (seen.has(key)) return;
            seen.add(key);

            conflicts.push({
              type,
              severity: "BLOCKER",
              termName: first.termName,
              dayOfWeek: firstSlot.dayOfWeek,
              startTime: firstSlot.startTime,
              endTime: firstSlot.endTime,
              conflictWithStartTime: secondSlot.startTime,
              conflictWithEndTime: secondSlot.endTime,
              roomCode: sameRoom ? firstSlot.roomCode : "-",
              batchCodes,
              teacherCodes,
              first: label(first),
              second: label(second),
            });
          };

          if (sameRoom) {
            pushConflict("ROOM_CONFLICT", [], []);
          }

          if (commonBatches.length > 0) {
            pushConflict("BATCH_CONFLICT", commonBatches, []);
          }

          if (commonTeachers.length > 0) {
            pushConflict("FACULTY_CONFLICT", [], commonTeachers);
          }
        }
      }
    }
  }

  const offeringFilteredConflicts = options.offeringId
    ? conflicts.filter(
        (conflict) =>
          conflict.first.offeringId === options.offeringId ||
          conflict.second.offeringId === options.offeringId
      )
    : conflicts;

  return {
    ok: true,
    conflicts: offeringFilteredConflicts,
    summary: {
      total: offeringFilteredConflicts.length,
      roomConflicts: offeringFilteredConflicts.filter(
        (item) => item.type === "ROOM_CONFLICT"
      ).length,
      batchConflicts: offeringFilteredConflicts.filter(
        (item) => item.type === "BATCH_CONFLICT"
      ).length,
      facultyConflicts: offeringFilteredConflicts.filter(
        (item) => item.type === "FACULTY_CONFLICT"
      ).length,
    },
  };
}
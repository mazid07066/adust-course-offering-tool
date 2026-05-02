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

function sectionGroupId(slot: {
  offered_courses: {
    id: number;
    primary_offered_course_id: number | null;
  };
}) {
  return slot.offered_courses.primary_offered_course_id || slot.offered_courses.id;
}

function buildCourseLabel(slot: any) {
  return {
    offeringId: slot.offered_courses.offering_id,
    offeredCourseId: slot.offered_courses.id,
    programCode: slot.offered_courses.offerings.programs.short_name,
    courseCode: slot.offered_courses.master_courses.course_code,
    courseTitle: slot.offered_courses.master_courses.course_title,
    section: slot.offered_courses.section,
    status: slot.offered_courses.offerings.status,
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
              ? { name: String(options.termName).trim().toUpperCase() }
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

  const slots = await prisma.offered_course_slots.findMany({
    where: {
      offered_courses: {
        ...(options.offeringId ? { offering_id: options.offeringId } : {}),
        offerings: {
          ...(term?.id ? { academic_term_id: term.id } : {}),
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
          offerings: {
            include: {
              academic_terms: true,
              programs: true,
            },
          },
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
        },
      },
    },
    orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
  });

  const conflicts: ScheduleConflictItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < slots.length; i += 1) {
    const first = slots[i];

    for (let j = i + 1; j < slots.length; j += 1) {
      const second = slots[j];

      if (first.day_of_week !== second.day_of_week) continue;

      if (
        !overlaps(
          first.start_time,
          first.end_time,
          second.start_time,
          second.end_time
        )
      ) {
        continue;
      }

      if (sectionGroupId(first) === sectionGroupId(second)) continue;

      const firstBatches = unique(
        first.offered_courses.offered_course_batches.map(
          (row) => row.batches.batch_code
        )
      );

      const secondBatches = unique(
        second.offered_courses.offered_course_batches.map(
          (row) => row.batches.batch_code
        )
      );

      const commonBatches = intersection(firstBatches, secondBatches);

      const firstTeachers = unique(
        first.offered_courses.offered_course_teachers.map(
          (row) => row.teachers.teacher_code
        )
      );

      const secondTeachers = unique(
        second.offered_courses.offered_course_teachers.map(
          (row) => row.teachers.teacher_code
        )
      );

      const commonTeachers = intersection(firstTeachers, secondTeachers);
      const sameRoom = first.room_id === second.room_id;

      const pushConflict = (
        type: ScheduleConflictType,
        batchCodes: string[],
        teacherCodes: string[]
      ) => {
        const key = [
          type,
          first.id,
          second.id,
          batchCodes.join(","),
          teacherCodes.join(","),
        ].join("|");

        if (seen.has(key)) return;
        seen.add(key);

        conflicts.push({
          type,
          severity: "BLOCKER",
          termName: first.offered_courses.offerings.academic_terms.name,
          dayOfWeek: first.day_of_week,
          startTime: first.start_time,
          endTime: first.end_time,
          conflictWithStartTime: second.start_time,
          conflictWithEndTime: second.end_time,
          roomCode: sameRoom ? first.rooms?.room_code || "-" : "-",
          batchCodes,
          teacherCodes,
          first: buildCourseLabel(first),
          second: buildCourseLabel(second),
        });
      };

      if (sameRoom) pushConflict("ROOM_CONFLICT", [], []);
      if (commonBatches.length > 0) pushConflict("BATCH_CONFLICT", commonBatches, []);
      if (commonTeachers.length > 0) pushConflict("FACULTY_CONFLICT", [], commonTeachers);
    }
  }

  const filtered = options.offeringId
    ? conflicts.filter(
        (conflict) =>
          conflict.first.offeringId === options.offeringId ||
          conflict.second.offeringId === options.offeringId
      )
    : conflicts;

  return {
    ok: true,
    conflicts: filtered,
    summary: {
      total: filtered.length,
      roomConflicts: filtered.filter((item) => item.type === "ROOM_CONFLICT").length,
      batchConflicts: filtered.filter((item) => item.type === "BATCH_CONFLICT").length,
      facultyConflicts: filtered.filter((item) => item.type === "FACULTY_CONFLICT")
        .length,
    },
  };
}
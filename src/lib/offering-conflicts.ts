import { prisma } from "@/lib/prisma";

export type MeetingInput = {
  day_of_week: string;
  start_time: string;
  duration_hours: number;
  room_id: number;
};

export type OfferingRowInput = {
  master_course_id: number;
  section: string;
  faculty_id: number;
  batch_ids: number[];
  meetings: MeetingInput[];
};

export type ConflictItem = {
  type:
    | "FACULTY_DRAFT_CLASH"
    | "ROOM_DRAFT_CLASH"
    | "SECTION_DRAFT_DUPLICATE"
    | "SECTION_DRAFT_OVERLAP"
    | "FACULTY_DB_CLASH"
    | "ROOM_DB_CLASH"
    | "SECTION_DB_DUPLICATE"
    | "BATCH_COMPLETED_BLOCK"
    | "BATCH_ONGOING_BLOCK";
  severity: "BLOCK" | "WARNING";
  message: string;
};

export function addDuration(startTime: string, durationHours: number) {
  const [h, m] = startTime.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const endMinutes = startMinutes + Math.round(durationHours * 60);

  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;

  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function overlaps(startA: string, endA: string, startB: string, endB: string) {
  const a1 = timeToMinutes(startA);
  const a2 = timeToMinutes(endA);
  const b1 = timeToMinutes(startB);
  const b2 = timeToMinutes(endB);

  return a1 < b2 && b1 < a2;
}

export function normalizeCourseCode(raw: string) {
  return raw.replace(/\s+/g, "").trim().toUpperCase();
}

export function normalizeTitle(title: string) {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

type DraftSlot = {
  rowIndex: number;
  meetingIndex: number;
  master_course_id: number;
  section: string;
  faculty_id: number;
  room_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
};

export function buildDraftSlots(rows: OfferingRowInput[]): DraftSlot[] {
  const slots: DraftSlot[] = [];

  rows.forEach((row, rowIndex) => {
    row.meetings.forEach((meeting, meetingIndex) => {
      slots.push({
        rowIndex,
        meetingIndex,
        master_course_id: row.master_course_id,
        section: row.section,
        faculty_id: row.faculty_id,
        room_id: meeting.room_id,
        day_of_week: String(meeting.day_of_week || "").trim().toUpperCase(),
        start_time: meeting.start_time,
        end_time: addDuration(meeting.start_time, meeting.duration_hours),
      });
    });
  });

  return slots;
}

export function validateInternalDraftClashes(rows: OfferingRowInput[]) {
  const conflicts: ConflictItem[] = [];

  const courseSectionKeys = new Set<string>();

  for (const row of rows) {
    const key = `${row.master_course_id}__${row.section}`;
    if (courseSectionKeys.has(key)) {
      conflicts.push({
        type: "SECTION_DRAFT_DUPLICATE",
        severity: "BLOCK",
        message: `Duplicate draft row found for course ID ${row.master_course_id}, section ${row.section}.`,
      });
    }
    courseSectionKeys.add(key);
  }

  const slots = buildDraftSlots(rows);

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];

      if (a.day_of_week !== b.day_of_week) continue;
      if (!overlaps(a.start_time, a.end_time, b.start_time, b.end_time)) continue;

      if (a.faculty_id === b.faculty_id) {
        conflicts.push({
          type: "FACULTY_DRAFT_CLASH",
          severity: "BLOCK",
          message:
            `Faculty conflict inside draft. Faculty ID ${a.faculty_id} is assigned on ${a.day_of_week} ` +
            `from ${a.start_time}-${a.end_time} and also from ${b.start_time}-${b.end_time}. ` +
            `Draft rows ${a.rowIndex + 1} and ${b.rowIndex + 1}.`,
        });
      }

      if (a.room_id === b.room_id) {
        conflicts.push({
          type: "ROOM_DRAFT_CLASH",
          severity: "BLOCK",
          message:
            `Room conflict inside draft. Room ID ${a.room_id} is used on ${a.day_of_week} ` +
            `from ${a.start_time}-${a.end_time} and also from ${b.start_time}-${b.end_time}. ` +
            `Draft rows ${a.rowIndex + 1} and ${b.rowIndex + 1}.`,
        });
      }

      if (a.master_course_id === b.master_course_id && a.section === b.section) {
        conflicts.push({
          type: "SECTION_DRAFT_OVERLAP",
          severity: "BLOCK",
          message:
            `Same course-section overlaps inside draft. Course ID ${a.master_course_id}, section ${a.section}, ` +
            `${a.day_of_week}, ${a.start_time}-${a.end_time} overlaps with ${b.start_time}-${b.end_time}.`,
        });
      }
    }
  }

  return conflicts;
}

export async function validateBatchEligibility(rows: OfferingRowInput[]) {
  const conflicts: ConflictItem[] = [];

  const masterCourseIds = [...new Set(rows.map((r) => r.master_course_id))];
  const batchIds = [...new Set(rows.flatMap((r) => r.batch_ids))];

  const masterCourses = await prisma.master_courses.findMany({
    where: { id: { in: masterCourseIds } },
  });

  const masterMap = new Map(masterCourses.map((c) => [c.id, c]));

  const completed = await prisma.batch_completed_courses.findMany({
    where: { batch_id: { in: batchIds } },
  });

  const current = await prisma.batch_current_registrations.findMany({
    where: { batch_id: { in: batchIds } },
  });

  for (const row of rows) {
    const master = masterMap.get(row.master_course_id);
    if (!master) continue;

    const codeKey = normalizeCourseCode(master.course_code);
    const titleKey = normalizeTitle(master.normalized_title || master.course_title);

    for (const batchId of row.batch_ids) {
      const isCompleted = completed.some(
        (c) =>
          c.batch_id === batchId &&
          (
            normalizeCourseCode(c.course_code) === codeKey ||
            normalizeTitle(c.normalized_title || c.course_title) === titleKey
          )
      );

      const isCurrent = current.some(
        (c) =>
          c.batch_id === batchId &&
          (
            normalizeCourseCode(c.course_code) === codeKey ||
            normalizeTitle(c.normalized_title || c.course_title) === titleKey
          )
      );

      if (isCompleted) {
        conflicts.push({
          type: "BATCH_COMPLETED_BLOCK",
          severity: "BLOCK",
          message: `Batch ID ${batchId} cannot be assigned to ${master.course_code} because that batch already completed the course.`,
        });
      } else if (isCurrent) {
        conflicts.push({
          type: "BATCH_ONGOING_BLOCK",
          severity: "BLOCK",
          message: `Batch ID ${batchId} cannot be assigned to ${master.course_code} because that batch is currently taking the course.`,
        });
      }
    }
  }

  return conflicts;
}

export async function validateDatabaseClashes(
  academicTermId: number,
  rows: OfferingRowInput[]
) {
  const conflicts: ConflictItem[] = [];

  const masterCourseIds = [...new Set(rows.map((r) => r.master_course_id))];
  const facultyIds = [...new Set(rows.map((r) => r.faculty_id))];
  const roomIds = [...new Set(rows.flatMap((r) => r.meetings.map((m) => m.room_id)))];

  const masterCourses = await prisma.master_courses.findMany({
    where: { id: { in: masterCourseIds } },
  });
  const masterMap = new Map(masterCourses.map((c) => [c.id, c]));

  const teachers = await prisma.teachers.findMany({
    where: { id: { in: facultyIds } },
  });
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  const rooms = await prisma.rooms.findMany({
    where: { id: { in: roomIds } },
  });
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const existingOfferings = await prisma.offerings.findMany({
    where: {
      academic_term_id: academicTermId,
      status: {
        in: ["DRAFT", "CONFIRMED"],
      },
    },
    include: {
      programs: true,
      offered_courses: {
        include: {
          master_courses: true,
          offered_course_teachers: {
            include: {
              teachers: true,
            },
          },
          offered_course_slots: {
            include: {
              rooms: true,
            },
          },
        },
      },
    },
  });

  const draftSlots = buildDraftSlots(rows);

  const existingSlots = existingOfferings.flatMap((offering) =>
    offering.offered_courses.flatMap((course) =>
      course.offered_course_slots.map((slot) => ({
        program_code: offering.programs.short_name,
        master_course_id: course.master_course_id,
        course_code: course.master_courses.course_code,
        course_title: course.master_courses.course_title,
        section: course.section,
        room_id: slot.room_id,
        room_code: slot.rooms?.room_code || `Room ID ${slot.room_id}`,
        day_of_week: String(slot.day_of_week || "").trim().toUpperCase(),
        start_time: slot.start_time,
        end_time: slot.end_time,
        faculty_ids: course.offered_course_teachers.map((t) => t.teacher_id),
        faculty_names: course.offered_course_teachers.map(
          (t) => t.teachers?.full_name || `Faculty ID ${t.teacher_id}`
        ),
      }))
    )
  );

  for (const draft of draftSlots) {
    const draftCourse = masterMap.get(draft.master_course_id);
    const draftTeacher = teacherMap.get(draft.faculty_id);
    const draftRoom = roomMap.get(draft.room_id);

    for (const existing of existingSlots) {
      if (draft.day_of_week !== existing.day_of_week) continue;
      if (!overlaps(draft.start_time, draft.end_time, existing.start_time, existing.end_time)) continue;

      if (existing.faculty_ids.includes(draft.faculty_id)) {
        conflicts.push({
          type: "FACULTY_DB_CLASH",
          severity: "BLOCK",
          message:
            `Faculty conflict with existing ${existing.program_code} offering. ` +
            `${draftTeacher?.full_name || `Faculty ID ${draft.faculty_id}`} is already assigned to ` +
            `${existing.course_code} section ${existing.section} on ${draft.day_of_week} ` +
            `from ${existing.start_time}-${existing.end_time}. Your draft course is ` +
            `${draftCourse?.course_code || draft.master_course_id} section ${draft.section} ` +
            `on ${draft.start_time}-${draft.end_time}.`,
        });
      }

      if (draft.room_id === existing.room_id) {
        conflicts.push({
          type: "ROOM_DB_CLASH",
          severity: "BLOCK",
          message:
            `Room conflict with existing ${existing.program_code} offering. ` +
            `${draftRoom?.room_code || `Room ID ${draft.room_id}`} is already occupied by ` +
            `${existing.course_code} section ${existing.section} on ${draft.day_of_week} ` +
            `from ${existing.start_time}-${existing.end_time}. Your draft uses the same room from ` +
            `${draft.start_time}-${draft.end_time}.`,
        });
      }

      if (
        draft.master_course_id === existing.master_course_id &&
        draft.section === existing.section
      ) {
        conflicts.push({
          type: "SECTION_DB_DUPLICATE",
          severity: "BLOCK",
          message:
            `Duplicate existing course-section found. ${existing.course_code} section ${existing.section} ` +
            `already exists in this semester.`,
        });
      }

      const facultyTightTransition =
        existing.faculty_ids.includes(draft.faculty_id) &&
        (
          timeToMinutes(draft.start_time) === timeToMinutes(existing.end_time) ||
          timeToMinutes(existing.start_time) === timeToMinutes(draft.end_time)
        );

      if (facultyTightTransition) {
        conflicts.push({
          type: "FACULTY_DB_CLASH",
          severity: "WARNING",
          message:
            `Tight transition warning for faculty ${draftTeacher?.full_name || draft.faculty_id}. ` +
            `One class ends exactly when another begins on ${draft.day_of_week}.`,
        });
      }

      const roomTightTransition =
        draft.room_id === existing.room_id &&
        (
          timeToMinutes(draft.start_time) === timeToMinutes(existing.end_time) ||
          timeToMinutes(existing.start_time) === timeToMinutes(draft.end_time)
        );

      if (roomTightTransition) {
        conflicts.push({
          type: "ROOM_DB_CLASH",
          severity: "WARNING",
          message:
            `Tight transition warning for room ${draftRoom?.room_code || draft.room_id}. ` +
            `One class ends exactly when another begins on ${draft.day_of_week}.`,
        });
      }
    }
  }

  return conflicts;
}

export async function analyzeOfferingConflicts(
  academicTermId: number,
  rows: OfferingRowInput[]
) {
  const internal = validateInternalDraftClashes(rows);
  const eligibility = await validateBatchEligibility(rows);
  const db = await validateDatabaseClashes(academicTermId, rows);

  const all = [...internal, ...eligibility, ...db];

  return {
    conflicts: all.filter((x) => x.severity === "BLOCK"),
    warnings: all.filter((x) => x.severity === "WARNING"),
    hasBlockingConflicts: all.some((x) => x.severity === "BLOCK"),
  };
}
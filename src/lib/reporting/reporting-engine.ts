import { prisma } from "@/lib/prisma";
import {
  REPORT_VISIBLE_OFFERING_STATUSES,
  normalizeReportParam,
  uniqueStrings,
} from "@/lib/report-visible-statuses";

export type ReportScheduleRow = {
  offeredCourseId: number;
  offeringId: number;
  offeringStatus: string;
  programCode: string;
  programName: string;
  courseCode: string;
  courseTitle: string;
  courseType: string;
  section: string;
  credit: number;
  role: "PRIMARY" | "SECONDARY";
  primaryReference: string;
  batchCodes: string[];
  facultyText: string;
  assignedFacultyCount: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  roomType: string;
  scheduleText: string;
  linkedSecondaryCourseCodes: string[];
  linkedSecondaryCourseText: string;
  linkedSecondaryBatchCodes: string[];
};

const DAY_ORDER: Record<string, number> = {
  THURSDAY: 1,
  FRIDAY: 2,
  SATURDAY: 3,
  SUNDAY: 4,
  MONDAY: 5,
  TUESDAY: 6,
  WEDNESDAY: 7,
};

function dayRank(day: string) {
  return DAY_ORDER[normalizeReportParam(day)] ?? 99;
}

function compareTime(a: string, b: string) {
  if (a === b) return 0;
  if (a === "-") return 1;
  if (b === "-") return -1;
  return a.localeCompare(b);
}

function getRoomText(slot: any) {
  if (!slot?.rooms) return "-";
  return slot.rooms.room_code || "-";
}

function getRoomType(slot: any) {
  if (!slot?.rooms) return "-";
  return slot.rooms.room_type || "-";
}

function buildFacultyText(assignments: any[]) {
  if (!assignments.length) return "-";

  return uniqueStrings(
    assignments.map((row) => {
      const teacher = row.teachers;
      if (!teacher) return "";
      return `${teacher.teacher_code} - ${teacher.full_name}`;
    })
  ).join(", ");
}

function buildScheduleText(slots: any[]) {
  if (!slots.length) return "-";

  return slots
    .map(
      (slot) =>
        `${slot.day_of_week} ${slot.start_time}-${slot.end_time} | ${getRoomText(slot)}`
    )
    .join(" ; ");
}

export async function getReportTerm(termNameInput: string | null | undefined) {
  const termName = normalizeReportParam(termNameInput);

  if (!termName) {
    throw new Error("termName is required.");
  }

  const term = await prisma.academic_terms.findFirst({
    where: { name: termName },
    select: { id: true, name: true },
  });

  if (!term) {
    throw new Error("Academic term not found.");
  }

  return term;
}

export async function getReportScheduleRows(params: {
  termName: string;
  programCode?: string;
  batchCode?: string;
  roomCode?: string;
  status?: string;
}) {
  const term = await getReportTerm(params.termName);

  const programCode = normalizeReportParam(params.programCode);
  const batchCode = normalizeReportParam(params.batchCode);
  const roomCode = normalizeReportParam(params.roomCode);
  const status = normalizeReportParam(params.status);

  const visibleStatuses = status ? [status] : [...REPORT_VISIBLE_OFFERING_STATUSES];

  const courses = await prisma.offered_courses.findMany({
    where: {
      offerings: {
        academic_term_id: term.id,
        status: {
          in: visibleStatuses,
        },
      },
      ...(programCode
        ? {
            master_courses: {
              program: {
                short_name: programCode,
              },
            },
          }
        : {}),
      ...(batchCode
        ? {
            offered_course_batches: {
              some: {
                batches: {
                  batch_code: batchCode,
                },
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      offering_id: true,
      section: true,
      primary_offered_course_id: true,
      is_cooffered: true,

      offerings: {
        select: {
          status: true,
        },
      },

      master_courses: {
        select: {
          course_code: true,
          course_title: true,
          course_type: true,
          credit: true,
          program: {
            select: {
              short_name: true,
              name: true,
            },
          },
        },
      },

      offered_course_batches: {
        select: {
          batches: {
            select: {
              batch_code: true,
            },
          },
        },
      },

      offered_course_slots: {
        orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
        select: {
          day_of_week: true,
          start_time: true,
          end_time: true,
          slot_type: true,
          rooms: {
            select: {
              room_code: true,
              room_type: true,
            },
          },
        },
      },

      offered_course_teachers: {
        select: {
          id: true,
          assigned_credit: true,
          load_type: true,
          teachers: {
            select: {
              id: true,
              teacher_code: true,
              full_name: true,
              designation: true,
            },
          },
        },
      },

      primary_offered_course: {
        select: {
          id: true,
          section: true,
          master_courses: {
            select: {
              course_code: true,
              course_title: true,
              program: {
                select: {
                  short_name: true,
                },
              },
            },
          },
          offered_course_slots: {
            orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
            select: {
              day_of_week: true,
              start_time: true,
              end_time: true,
              slot_type: true,
              rooms: {
                select: {
                  room_code: true,
                  room_type: true,
                },
              },
            },
          },
          offered_course_teachers: {
            select: {
              id: true,
              assigned_credit: true,
              load_type: true,
              teachers: {
                select: {
                  id: true,
                  teacher_code: true,
                  full_name: true,
                  designation: true,
                },
              },
            },
          },
        },
      },

      secondary_offered_courses: {
        select: {
          id: true,
          section: true,
          master_courses: {
            select: {
              course_code: true,
              course_title: true,
              program: {
                select: {
                  short_name: true,
                },
              },
            },
          },
          offered_course_batches: {
            select: {
              batches: {
                select: {
                  batch_code: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ offering_id: "asc" }, { section: "asc" }, { id: "asc" }],
  });

  const rows: ReportScheduleRow[] = [];

  for (const course of courses) {
    const effectiveSlots =
      course.primary_offered_course?.offered_course_slots?.length
        ? course.primary_offered_course.offered_course_slots
        : course.offered_course_slots;

    const effectiveTeachers =
      course.primary_offered_course?.offered_course_teachers?.length
        ? course.primary_offered_course.offered_course_teachers
        : course.offered_course_teachers;

    const batchCodes = uniqueStrings(
      course.offered_course_batches.map((row) => row.batches?.batch_code)
    );

    const linkedSecondaryCourseCodes = uniqueStrings(
      course.secondary_offered_courses.map(
        (secondary) => secondary.master_courses?.course_code
      )
    );

    const linkedSecondaryCourseText =
      course.secondary_offered_courses.length > 0
        ? course.secondary_offered_courses
            .map(
              (secondary) =>
                `${secondary.master_courses.program.short_name} ${secondary.master_courses.course_code} Sec-${secondary.section}`
            )
            .join(", ")
        : "-";

    const linkedSecondaryBatchCodes = uniqueStrings(
      course.secondary_offered_courses.flatMap((secondary) =>
        secondary.offered_course_batches.map((row) => row.batches?.batch_code)
      )
    );

    const facultyText = buildFacultyText(effectiveTeachers);
    const scheduleText = buildScheduleText(effectiveSlots);

    const baseRow = {
      offeredCourseId: course.id,
      offeringId: course.offering_id,
      offeringStatus: course.offerings.status,
      programCode: course.master_courses.program.short_name,
      programName: course.master_courses.program.name,
      courseCode: course.master_courses.course_code,
      courseTitle: course.master_courses.course_title,
      courseType: course.master_courses.course_type || "-",
      section: course.section,
      credit: Number(course.master_courses.credit || 0),
      role: course.primary_offered_course_id ? ("SECONDARY" as const) : ("PRIMARY" as const),
      primaryReference: course.primary_offered_course_id
        ? `${course.primary_offered_course?.master_courses?.course_code || "-"} Sec-${course.primary_offered_course?.section || "-"}`
        : "-",
      batchCodes,
      facultyText,
      assignedFacultyCount: effectiveTeachers.length,
      scheduleText,
      linkedSecondaryCourseCodes,
      linkedSecondaryCourseText,
      linkedSecondaryBatchCodes,
    };

    if (!effectiveSlots.length) {
      rows.push({
        ...baseRow,
        dayOfWeek: "-",
        startTime: "-",
        endTime: "-",
        roomCode: "-",
        roomType: "-",
      });
      continue;
    }

    for (const slot of effectiveSlots) {
      const rowRoomCode = getRoomText(slot);

      if (roomCode && rowRoomCode !== roomCode) {
        continue;
      }

      rows.push({
        ...baseRow,
        dayOfWeek: slot.day_of_week || "-",
        startTime: slot.start_time || "-",
        endTime: slot.end_time || "-",
        roomCode: rowRoomCode,
        roomType: getRoomType(slot),
      });
    }
  }

  rows.sort((a, b) => {
    if (a.programCode !== b.programCode) return a.programCode.localeCompare(b.programCode);
    if (a.batchCodes.join(",") !== b.batchCodes.join(",")) {
      return a.batchCodes.join(",").localeCompare(b.batchCodes.join(","));
    }
    if (dayRank(a.dayOfWeek) !== dayRank(b.dayOfWeek)) {
      return dayRank(a.dayOfWeek) - dayRank(b.dayOfWeek);
    }
    if (a.startTime !== b.startTime) return compareTime(a.startTime, b.startTime);
    if (a.roomCode !== b.roomCode) return a.roomCode.localeCompare(b.roomCode);
    return a.courseCode.localeCompare(b.courseCode);
  });

  return {
    term,
    filters: {
      programCode,
      batchCode,
      roomCode,
      status,
      visibleStatuses,
    },
    rows,
  };
}

export function summarizeScheduleRows(rows: ReportScheduleRow[]) {
  return {
    totalRows: rows.length,
    rowsWithRoom: rows.filter((row) => row.roomCode !== "-").length,
    rowsWithoutRoom: rows.filter((row) => row.roomCode === "-").length,
    rowsWithFaculty: rows.filter((row) => row.facultyText !== "-").length,
    rowsWithoutFaculty: rows.filter((row) => row.facultyText === "-").length,
    primaryRows: rows.filter((row) => row.role === "PRIMARY").length,
    secondaryRows: rows.filter((row) => row.role === "SECONDARY").length,
  };
}
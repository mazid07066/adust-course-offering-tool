import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  compareDayTime,
  isLabLikeText,
  isProjectLikeCourse,
  normalizeReportParam,
  REPORT_VISIBLE_OFFERING_STATUSES,
  uniqueStrings,
} from "@/lib/report-visible-statuses";

export type ReportScope = "COMBINED" | "PROGRAM" | "BATCH";

export type ScheduleKind = "ALL" | "CLASS" | "LAB" | "PROJECT";

export type ReportingFilters = {
  termName: string;
  programCode?: string;
  batchCode?: string;
  roomCode?: string;
  teacherCode?: string;
  scheduleKind?: ScheduleKind;
  statuses?: string[];
};

export type ReportingScheduleRow = {
  offeredCourseId: number;
  offeringId: number;
  offeringStatus: string;
  academicTerm: string;
  programCode: string;
  programName: string;
  departmentCode: string;
  departmentName: string;
  courseCode: string;
  courseTitle: string;
  courseType: string;
  section: string;
  credit: number;
  role: "PRIMARY" | "SECONDARY";
  primaryOfferedCourseId: number | null;
  primaryReference: string;
  batchCodes: string[];
  facultyText: string;
  facultyCodes: string[];
  facultyNames: string[];
  assignedFacultyCount: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  roomType: string;
  scheduleKind: ScheduleKind;
  scheduleText: string;
};

export type FacultyLoadRow = {
  teacherId: number;
  teacherCode: string;
  teacherName: string;
  designation: string;
  departmentCode: string;
  departmentName: string;
  phone: string;
  email: string;
  seniorityLevel: number | null;
  totalCredits: number;
  theoryCredits: number;
  labCredits: number;
  projectCredits: number;
  assignedCourses: Array<{
    offeredCourseId: number;
    offeringStatus: string;
    programCode: string;
    courseCode: string;
    courseTitle: string;
    section: string;
    credit: number;
    assignedCredit: number;
    loadType: string;
    batchCodes: string[];
    scheduleText: string;
  }>;
};

export type OfferingSummaryRow = {
  offeredCourseId: number;
  offeringId: number;
  offeringStatus: string;
  academicTerm: string;
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
  scheduleText: string;
  coOfferedCourseText: string;
  coOfferedBatchText: string;
};

const offeredCourseReportInclude = {
  offerings: {
    include: {
      academic_terms: true,
      programs: {
        include: {
          departments: true,
        },
      },
    },
  },
  master_courses: {
    include: {
      program: {
        include: {
          departments: true,
        },
      },
    },
  },
  offered_course_batches: {
    include: {
      batches: true,
    },
  },
  offered_course_slots: {
    orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
    include: {
      rooms: true,
    },
  },
  offered_course_teachers: {
    include: {
      teachers: {
        include: {
          departments: true,
        },
      },
    },
  },
  primary_offered_course: {
    include: {
      master_courses: {
        include: {
          program: true,
        },
      },
      offered_course_slots: {
        orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
        include: {
          rooms: true,
        },
      },
      offered_course_teachers: {
        include: {
          teachers: {
            include: {
              departments: true,
            },
          },
        },
      },
    },
  },
  secondary_offered_courses: {
    include: {
      master_courses: {
        include: {
          program: true,
        },
      },
      offered_course_batches: {
        include: {
          batches: true,
        },
      },
    },
  },
} satisfies Prisma.offered_coursesInclude;

type OfferedCourseReportPayload = Prisma.offered_coursesGetPayload<{
  include: typeof offeredCourseReportInclude;
}>;

type SlotPayload = OfferedCourseReportPayload["offered_course_slots"][number];

type TeacherAssignmentPayload =
  OfferedCourseReportPayload["offered_course_teachers"][number];

function cleanCode(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, "").trim().toUpperCase();
}

function getRoomCode(slot: SlotPayload | null | undefined) {
  return slot?.rooms?.room_code || "-";
}

function getRoomType(slot: SlotPayload | null | undefined) {
  return slot?.rooms?.room_type || "-";
}

function getEffectiveSlots(course: OfferedCourseReportPayload): SlotPayload[] {
  const primarySlots = course.primary_offered_course?.offered_course_slots || [];
  if (course.primary_offered_course_id && primarySlots.length > 0) {
    return primarySlots;
  }

  return course.offered_course_slots;
}

function getEffectiveTeachers(
  course: OfferedCourseReportPayload
): TeacherAssignmentPayload[] {
  const primaryTeachers =
    course.primary_offered_course?.offered_course_teachers || [];

  if (course.primary_offered_course_id && primaryTeachers.length > 0) {
    return primaryTeachers as TeacherAssignmentPayload[];
  }

  return course.offered_course_teachers;
}

function getBatchCodes(course: OfferedCourseReportPayload) {
  return uniqueStrings(
    course.offered_course_batches.map((row) => row.batches.batch_code)
  );
}

function getFacultyText(assignments: TeacherAssignmentPayload[]) {
  if (!assignments.length) return "-";

  return uniqueStrings(
    assignments.map(
      (row) => `${row.teachers.teacher_code} - ${row.teachers.full_name}`
    )
  ).join(", ");
}

function getFacultyCodes(assignments: TeacherAssignmentPayload[]) {
  return uniqueStrings(assignments.map((row) => row.teachers.teacher_code));
}

function getFacultyNames(assignments: TeacherAssignmentPayload[]) {
  return uniqueStrings(assignments.map((row) => row.teachers.full_name));
}

function getPrimaryReference(course: OfferedCourseReportPayload) {
  if (!course.primary_offered_course_id) return "-";

  return `${course.primary_offered_course?.master_courses.course_code || "-"} Sec-${
    course.primary_offered_course?.section || "-"
  }`;
}

function resolveScheduleKind(
  course: OfferedCourseReportPayload,
  slot: SlotPayload | null
): ScheduleKind {
  if (
    isProjectLikeCourse({
      courseCode: course.master_courses.course_code,
      courseTitle: course.master_courses.course_title,
      courseType: course.master_courses.course_type,
    })
  ) {
    return "PROJECT";
  }

  if (
    isLabLikeText(course.master_courses.course_type) ||
    isLabLikeText(course.master_courses.course_title) ||
    isLabLikeText(slot?.slot_type) ||
    isLabLikeText(slot?.rooms?.room_type)
  ) {
    return "LAB";
  }

  return "CLASS";
}

function buildScheduleTextFromSlots(slots: SlotPayload[]) {
  if (!slots.length) return "-";

  return slots
    .map(
      (slot) =>
        `${slot.day_of_week} ${slot.start_time}-${slot.end_time} | ${
          slot.rooms?.room_code || "-"
        }`
    )
    .join(" ; ");
}

function applyRowFilters(
  rows: ReportingScheduleRow[],
  filters: ReportingFilters
) {
  const roomCode = cleanCode(filters.roomCode);
  const teacherCode = cleanCode(filters.teacherCode);
  const kind = normalizeReportParam(filters.scheduleKind || "ALL");

  return rows.filter((row) => {
    if (roomCode && cleanCode(row.roomCode) !== roomCode) return false;

    if (
      teacherCode &&
      !row.facultyCodes.some((code) => cleanCode(code) === teacherCode)
    ) {
      return false;
    }

    if (kind && kind !== "ALL" && row.scheduleKind !== kind) return false;

    return true;
  });
}

type ProgramIdentity = {
  isEEE: boolean;
  isRAE: boolean;
  isEvening: boolean;
  isRegular: boolean;
  isNew: boolean;
  isOld: boolean;
};

function detectProgramIdentity(
  values: Array<string | null | undefined>
): ProgramIdentity {
  const text = values
    .map((value) => cleanCode(value))
    .join(" ");

  return {
    isEEE: text.includes("EEE"),
    isRAE:
      text.includes("RAE") ||
      text.includes("ROBOTICSANDAUTOMATION"),
    isEvening:
      text.includes("EVE") ||
      text.includes("EVENING"),
    isRegular:
      text.includes("REG") ||
      text.includes("REGULAR"),
    isNew: text.includes("NEW"),
    isOld: text.includes("OLD"),
  };
}

function programIdentityMatches(
  selectedProgramCode: string,
  course: OfferedCourseReportPayload
) {
  const selected = detectProgramIdentity([
    selectedProgramCode,
  ]);

  const courseIdentity = detectProgramIdentity([
    course.offerings.programs.short_name,
    course.offerings.programs.name,
    course.master_courses.program.short_name,
    course.master_courses.program.name,
  ]);

  if (selected.isEEE && !courseIdentity.isEEE) {
    return false;
  }

  if (selected.isRAE && !courseIdentity.isRAE) {
    return false;
  }

  if (selected.isEvening && !courseIdentity.isEvening) {
    return false;
  }

  if (
    selected.isRegular &&
    courseIdentity.isEvening
  ) {
    return false;
  }

  /*
   * RAE currently shares one canonical operational identity
   * across NEW and OLD curriculum variants.
   *
   * Therefore NEW/OLD must not reject RAE reporting rows.
   */
  if (!selected.isRAE) {
    if (
      selected.isNew &&
      courseIdentity.isOld
    ) {
      return false;
    }

    if (
      selected.isOld &&
      courseIdentity.isNew
    ) {
      return false;
    }
  }

  return selected.isEEE || selected.isRAE;
}

export async function getReportTerm(termName: string) {
  const cleanTermName = normalizeReportParam(termName);

  if (!cleanTermName) {
    throw new Error("termName is required.");
  }

  const term = await prisma.academic_terms.findFirst({
    where: {
      name: cleanTermName,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!term) {
    throw new Error("Academic term not found.");
  }

  return term;
}

export async function getOfferedCoursesForReporting(
  filters: ReportingFilters
): Promise<OfferedCourseReportPayload[]> {
  const term = await getReportTerm(filters.termName);

  const programCode = cleanCode(filters.programCode);
  const batchCode = cleanCode(filters.batchCode);

  const statuses =
    filters.statuses && filters.statuses.length > 0
      ? filters.statuses.map(normalizeReportParam)
      : REPORT_VISIBLE_OFFERING_STATUSES;

  /*
   * Program identity must not be filtered directly against
   * offerings.programs.short_name.
   *
   * UniFlow currently contains:
   *
   * Academic/catalog identity:
   *   BSC-EEE-REG-NEW
   *
   * Operational offering identity:
   *   CANON-EEE-REG-BSCEEE
   *
   * Master-course/report identity:
   *   BSC-EEE-REG-NEW
   *
   * Therefore a direct Prisma equality comparison between
   * selected academic programCode and the operational program
   * removes valid rows.
   *
   * We first retrieve correctly scoped term/status/batch data,
   * then apply the academic identity filter using both
   * operational and master-course identities.
   */

  const courses =
    await prisma.offered_courses.findMany({
      where: {
        offerings: {
          academic_term_id: term.id,
          status: {
            in: statuses,
          },
        },

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

      include: offeredCourseReportInclude,

      orderBy: [
        {
          offering_id: "asc",
        },
        {
          section: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

  if (!programCode) {
    return courses;
  }

  return courses.filter((course) =>
    programIdentityMatches(
      programCode,
      course
    )
  );
}
import { getCacheKey, getCached, setCache } from "@/lib/reporting-cache";

export async function getScheduleRowsForReporting(
  filters: ReportingFilters
): Promise<ReportingScheduleRow[]> {
  const cacheKey = getCacheKey("scheduleRows", filters);

  const cached = getCached<ReportingScheduleRow[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const courses = await getOfferedCoursesForReporting(filters);

  const rows: ReportingScheduleRow[] = [];

  for (const course of courses) {
    const effectiveSlots = getEffectiveSlots(course);
    const effectiveTeachers = getEffectiveTeachers(course);

    const facultyText = getFacultyText(effectiveTeachers);
    const facultyCodes = getFacultyCodes(effectiveTeachers);
    const facultyNames = getFacultyNames(effectiveTeachers);
    const batchCodes = getBatchCodes(course);
    const scheduleText = buildScheduleTextFromSlots(effectiveSlots);

    const baseRow = {
      offeredCourseId: course.id,
      offeringId: course.offering_id,
      offeringStatus: course.offerings.status,
      academicTerm: course.offerings.academic_terms.name,
      programCode: course.master_courses.program.short_name,
      programName: course.master_courses.program.name,
      departmentCode: course.master_courses.program.departments.short_name,
      departmentName: course.master_courses.program.departments.name,
      courseCode: course.master_courses.course_code,
      courseTitle: course.master_courses.course_title,
      courseType: course.master_courses.course_type,
      section: course.section,
      credit: Number(course.master_courses.credit || 0),
      role: course.primary_offered_course_id
        ? ("SECONDARY" as const)
        : ("PRIMARY" as const),
      primaryOfferedCourseId: course.primary_offered_course_id,
      primaryReference: getPrimaryReference(course),
      batchCodes,
      facultyText,
      facultyCodes,
      facultyNames,
      assignedFacultyCount: effectiveTeachers.length,
      scheduleText,
    };

    if (!effectiveSlots.length) {
      rows.push({
        ...baseRow,
        dayOfWeek: "-",
        startTime: "-",
        endTime: "-",
        roomCode: "-",
        roomType: "-",
        scheduleKind: resolveScheduleKind(course, null),
      });
    } else {
      for (const slot of effectiveSlots) {
        rows.push({
          ...baseRow,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          roomCode: getRoomCode(slot),
          roomType: getRoomType(slot),
          scheduleKind: resolveScheduleKind(course, slot),
        });
      }
    }
  }

  const result = applyRowFilters(rows, filters).sort(compareDayTime);

  setCache(cacheKey, result);

  return result;
}

export async function getOfferingSummaryRowsForReporting(
  filters: ReportingFilters
): Promise<OfferingSummaryRow[]> {
  const courses = await getOfferedCoursesForReporting(filters);

  return courses.map((course) => {
    const effectiveSlots = getEffectiveSlots(course);
    const effectiveTeachers = getEffectiveTeachers(course);

    const secondaryCourses = course.secondary_offered_courses || [];

    const coOfferedCourseText =
      secondaryCourses.length > 0
        ? secondaryCourses
            .map(
              (row) =>
                `${row.master_courses.program.short_name} | ${row.master_courses.course_code} Sec-${row.section}`
            )
            .join(" ; ")
        : "-";

    const coOfferedBatchText =
      secondaryCourses.length > 0
        ? uniqueStrings(
            secondaryCourses.flatMap((row) =>
              row.offered_course_batches.map((batchRow) => batchRow.batches.batch_code)
            )
          ).join(", ")
        : "-";

    return {
      offeredCourseId: course.id,
      offeringId: course.offering_id,
      offeringStatus: course.offerings.status,
      academicTerm: course.offerings.academic_terms.name,
      programCode: course.master_courses.program.short_name,
      programName: course.master_courses.program.name,
      courseCode: course.master_courses.course_code,
      courseTitle: course.master_courses.course_title,
      courseType: course.master_courses.course_type,
      section: course.section,
      credit: Number(course.master_courses.credit || 0),
      role: course.primary_offered_course_id ? "SECONDARY" : "PRIMARY",
      primaryReference: getPrimaryReference(course),
      batchCodes: getBatchCodes(course),
      facultyText: getFacultyText(effectiveTeachers),
      scheduleText: buildScheduleTextFromSlots(effectiveSlots),
      coOfferedCourseText,
      coOfferedBatchText,
    };
  });
}

export async function getFacultyLoadRowsForReporting(
  filters: ReportingFilters
): Promise<FacultyLoadRow[]> {
  const courses = await getOfferedCoursesForReporting(filters);
  const map = new Map<number, FacultyLoadRow>();

  for (const course of courses) {
    const effectiveSlots = getEffectiveSlots(course);
    const scheduleText = buildScheduleTextFromSlots(effectiveSlots);
    const scheduleKind = resolveScheduleKind(course, effectiveSlots[0] || null);
    const batchCodes = getBatchCodes(course);

    for (const assignment of course.offered_course_teachers) {
      const teacher = assignment.teachers;
      const teacherId = teacher.id;
      const assignedCredit = Number(assignment.assigned_credit || 0);

      if (!map.has(teacherId)) {
        map.set(teacherId, {
          teacherId,
          teacherCode: teacher.teacher_code,
          teacherName: teacher.full_name,
          designation: teacher.designation || "-",
          departmentCode: teacher.departments?.short_name || "-",
          departmentName: teacher.departments?.name || "-",
          phone: teacher.phone || "-",
          email: teacher.email || "-",
          seniorityLevel: teacher.seniority_level ?? null,
          totalCredits: 0,
          theoryCredits: 0,
          labCredits: 0,
          projectCredits: 0,
          assignedCourses: [],
        });
      }

      const facultyRow = map.get(teacherId)!;

      facultyRow.totalCredits += assignedCredit;

      if (scheduleKind === "LAB") {
        facultyRow.labCredits += assignedCredit;
      } else if (scheduleKind === "PROJECT") {
        facultyRow.projectCredits += assignedCredit;
      } else {
        facultyRow.theoryCredits += assignedCredit;
      }

      facultyRow.assignedCourses.push({
        offeredCourseId: course.id,
        offeringStatus: course.offerings.status,
        programCode: course.master_courses.program.short_name,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        section: course.section,
        credit: Number(course.master_courses.credit || 0),
        assignedCredit,
        loadType: assignment.load_type || "-",
        batchCodes,
        scheduleText,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const levelA = a.seniorityLevel ?? 999;
    const levelB = b.seniorityLevel ?? 999;

    if (levelA !== levelB) return levelA - levelB;
    return a.teacherCode.localeCompare(b.teacherCode);
  });
}

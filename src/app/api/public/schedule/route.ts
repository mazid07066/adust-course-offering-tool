import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicScheduleSettings } from "@/lib/public-schedule-settings";
import {
  compareDayTime,
  REPORT_VISIBLE_OFFERING_STATUSES,
  uniqueStrings,
} from "@/lib/report-visible-statuses";

const PUBLIC_PROGRAMS = [
  "BSC-EEE-EVE-NEW",
  "BSC-EEE-REG-NEW",
  "BSC-RAE-REG-NEW",
];

type FacultyDetail = {
  id: number;
  teacherCode: string;
  fullName: string;
  designation: string;
  phone: string;
  email: string;
};

type PublicRoutineRow = {
  batchCode: string;
  programCode: string;
  programName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  facultyText: string;
  facultyDetails: FacultyDetail[];
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  scheduleKind: string;
  offeringStatus: string;
};

function normalizeUpper(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function buildFacultyText(facultyDetails: FacultyDetail[]) {
  if (facultyDetails.length === 0) return "-";

  return uniqueStrings(
    facultyDetails.map(
      (faculty) => `${faculty.teacherCode} - ${faculty.fullName}`
    )
  ).join(", ");
}

function uniqueFaculty(rows: FacultyDetail[]) {
  const map = new Map<number, FacultyDetail>();

  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, row);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.teacherCode.localeCompare(b.teacherCode)
  );
}

function detectScheduleKind(
  slotType: string | null | undefined,
  course: {
    course_title?: string | null;
    course_type?: string | null;
  }
) {
  const text = `${slotType || ""} ${course.course_title || ""} ${
    course.course_type || ""
  }`.toUpperCase();

  if (
    text.includes("LAB") ||
    text.includes("SESSIONAL") ||
    text.includes("PRACTICAL") ||
    text.includes("WORKSHOP")
  ) {
    return "LAB";
  }

  if (
    text.includes("PROJECT") ||
    text.includes("FYDP") ||
    text.includes("THESIS") ||
    text.includes("INTERNSHIP") ||
    text.includes("VIVA")
  ) {
    return "PROJECT";
  }

  return "CLASS";
}

async function buildRows(params: {
  termId: number;
  programCode?: string;
  batchCode?: string;
  dayOfWeek?: string;
}) {
  const courses = await prisma.offered_courses.findMany({
    where: {
      offerings: {
        academic_term_id: params.termId,
        status: {
          in: REPORT_VISIBLE_OFFERING_STATUSES,
        },
        programs: {
          short_name: params.programCode
            ? params.programCode
            : {
                in: PUBLIC_PROGRAMS,
              },
        },
      },
      offered_course_batches: params.batchCode
        ? {
            some: {
              batches: {
                batch_code: params.batchCode,
              },
            },
          }
        : undefined,
    },
    include: {
      offerings: {
        include: {
          programs: true,
        },
      },
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
    orderBy: [{ offering_id: "asc" }, { id: "asc" }],
  });

  const rows: PublicRoutineRow[] = [];

  for (const course of courses) {
    const effectiveSlots =
      course.primary_offered_course?.offered_course_slots.length
        ? course.primary_offered_course.offered_course_slots
        : course.offered_course_slots;

    const effectiveTeachers =
      course.primary_offered_course?.offered_course_teachers.length
        ? course.primary_offered_course.offered_course_teachers
        : course.offered_course_teachers;

    const facultyDetails = uniqueFaculty(
      effectiveTeachers.map((item) => ({
        id: item.teachers.id,
        teacherCode: item.teachers.teacher_code || "-",
        fullName: item.teachers.full_name || "-",
        designation: item.teachers.designation || "-",
        phone: item.teachers.phone || "-",
        email: item.teachers.email || "-",
      }))
    );

    const facultyText = buildFacultyText(facultyDetails);

    const courseBatchCodes = uniqueStrings(
      course.offered_course_batches.map((item) => item.batches.batch_code)
    );

    const visibleBatchCodes = params.batchCode
      ? courseBatchCodes.filter((item) => item === params.batchCode)
      : courseBatchCodes;

    const publicProgramCode = course.offerings.programs.short_name;
    const publicProgramName = course.offerings.programs.name;

    if (effectiveSlots.length === 0) {
      for (const itemBatchCode of visibleBatchCodes) {
        rows.push({
          batchCode: itemBatchCode,
          programCode: publicProgramCode,
          programName: publicProgramName,
          courseCode: course.master_courses.course_code,
          courseTitle: course.master_courses.course_title,
          section: course.section,
          facultyText,
          facultyDetails,
          dayOfWeek: "-",
          startTime: "-",
          endTime: "-",
          roomCode: "-",
          scheduleKind: detectScheduleKind(null, {
            course_title: course.master_courses.course_title,
            course_type: course.master_courses.course_type,
          }),
          offeringStatus: course.offerings.status,
        });
      }

      continue;
    }

    for (const slot of effectiveSlots) {
      if (
        params.dayOfWeek &&
        normalizeUpper(slot.day_of_week) !== params.dayOfWeek
      ) {
        continue;
      }

      for (const itemBatchCode of visibleBatchCodes) {
        rows.push({
          batchCode: itemBatchCode,
          programCode: publicProgramCode,
          programName: publicProgramName,
          courseCode: course.master_courses.course_code,
          courseTitle: course.master_courses.course_title,
          section: course.section,
          facultyText,
          facultyDetails,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          roomCode: slot.rooms?.room_code || "-",
          scheduleKind: detectScheduleKind(slot.slot_type, {
            course_title: course.master_courses.course_title,
            course_type: course.master_courses.course_type,
          }),
          offeringStatus: course.offerings.status,
        });
      }
    }
  }

  rows.sort((a, b) => {
    if (a.programCode !== b.programCode) {
      return a.programCode.localeCompare(b.programCode);
    }

    if (a.batchCode !== b.batchCode) {
      return a.batchCode.localeCompare(b.batchCode);
    }

    return compareDayTime(a, b);
  });

  return rows;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const programCode = normalizeUpper(searchParams.get("programCode"));
    const batchCode = normalizeUpper(searchParams.get("batchCode"));
    const dayOfWeek = normalizeUpper(searchParams.get("dayOfWeek"));

    /*
     * IMPORTANT:
     *
     * Public users are not allowed to choose the academic term.
     * The only authoritative public semester comes from the
     * admin-controlled PUBLIC_SCHEDULE_TERM_ID setting.
     *
     * Any termName query parameter is intentionally ignored.
     */
    const publicSettings = await getPublicScheduleSettings();

    if (!publicSettings.enabled) {
      return NextResponse.json(
        {
          error:
            "The official class schedule is not currently published.",
          publicScheduleEnabled: false,
          terms: [],
          filters: {
            programs: PUBLIC_PROGRAMS,
            batches: [],
            days: [],
          },
          rows: [],
        },
        { status: 403 }
      );
    }

    if (!publicSettings.academicTermId) {
      return NextResponse.json(
        {
          error:
            "The public schedule has not been assigned to an academic term.",
          publicScheduleEnabled: false,
          terms: [],
          filters: {
            programs: PUBLIC_PROGRAMS,
            batches: [],
            days: [],
          },
          rows: [],
        },
        { status: 503 }
      );
    }

    const term = await prisma.academic_terms.findUnique({
      where: {
        id: publicSettings.academicTermId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!term) {
      return NextResponse.json(
        {
          error:
            "The configured public academic term no longer exists.",
          publicScheduleEnabled: false,
          terms: [],
          filters: {
            programs: PUBLIC_PROGRAMS,
            batches: [],
            days: [],
          },
          rows: [],
        },
        { status: 503 }
      );
    }

    /*
     * The page currently performs a lightweight first request to discover
     * its term list. Return exactly ONE term: the administrator-released
     * public semester.
     */
    const bootstrapRequest =
      !searchParams.has("termName") &&
      !programCode &&
      !batchCode &&
      !dayOfWeek;

    if (bootstrapRequest) {
      return NextResponse.json({
        success: true,
        publicScheduleEnabled: true,
        termName: term.name,
        terms: [term.name],
        filters: {
          programs: PUBLIC_PROGRAMS,
          batches: [],
          days: [],
        },
        rows: [],
      });
    }

    const rowsBeforeBatchFilter = await buildRows({
      termId: term.id,
      programCode: programCode || undefined,
      dayOfWeek: undefined,
    });

    const rows = await buildRows({
      termId: term.id,
      programCode: programCode || undefined,
      batchCode: batchCode || undefined,
      dayOfWeek: dayOfWeek || undefined,
    });

    return NextResponse.json({
      success: true,
      termName: term.name,
      filters: {
        programs: PUBLIC_PROGRAMS,
        batches: programCode
          ? uniqueStrings(rowsBeforeBatchFilter.map((item) => item.batchCode)).sort()
          : [],
        days: uniqueStrings(rows.map((item) => item.dayOfWeek))
          .filter((item) => item !== "-")
          .sort(),
      },
      rows,
    });
  } catch (error) {
    console.error("Public schedule failed:", error);

    return NextResponse.json(
      { error: "Failed to load public schedule." },
      { status: 500 }
    );
  }
}
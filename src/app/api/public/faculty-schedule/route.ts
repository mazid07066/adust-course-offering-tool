import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type FacultyDetail = {
  id: number;
  teacherCode: string;
  fullName: string;
  designation: string;
  phone: string;
  email: string;
};

type FacultyRoutineRow = {
  faculty: FacultyDetail;
  programCode: string;
  programName: string;
  batchCodes: string[];
  courseCode: string;
  courseTitle: string;
  section: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  scheduleKind: string;
};

const DAY_ORDER = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

function normalize(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
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

function detectScheduleKind(slotType: string | null | undefined, title: string) {
  const text = `${slotType || ""} ${title || ""}`.toUpperCase();

  if (
    text.includes("LAB") ||
    text.includes("SESSIONAL") ||
    text.includes("PRACTICAL")
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

function compareRows(a: FacultyRoutineRow, b: FacultyRoutineRow) {
  if (a.faculty.teacherCode !== b.faculty.teacherCode) {
    return a.faculty.teacherCode.localeCompare(b.faculty.teacherCode);
  }

  const dayA = DAY_ORDER.indexOf(normalize(a.dayOfWeek));
  const dayB = DAY_ORDER.indexOf(normalize(b.dayOfWeek));

  if (dayA !== dayB) {
    return (dayA === -1 ? 999 : dayA) - (dayB === -1 ? 999 : dayB);
  }

  if (a.startTime !== b.startTime) {
    return a.startTime.localeCompare(b.startTime);
  }

  return a.courseCode.localeCompare(b.courseCode);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const termName = normalize(searchParams.get("termName"));
    const teacherIdRaw = searchParams.get("teacherId");
    const teacherId = teacherIdRaw ? Number(teacherIdRaw) : 0;
    const dayOfWeek = normalize(searchParams.get("dayOfWeek"));

    if (!termName) {
      const terms = await prisma.offerings.findMany({
        where: {
          status: "CONFIRMED",
        },
        select: {
          academic_terms: {
            select: {
              name: true,
            },
          },
        },
        distinct: ["academic_term_id"],
      });

      return NextResponse.json({
        success: true,
        terms: uniqueStrings(terms.map((item) => item.academic_terms.name)),
        facultyOptions: [],
        dayOptions: [],
        rows: [],
      });
    }

    const term = await prisma.academic_terms.findFirst({
      where: {
        name: termName,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const offeredCourses = await prisma.offered_courses.findMany({
      where: {
        offerings: {
          academic_term_id: term.id,
          status: "CONFIRMED",
        },
      },
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

    const allRows: FacultyRoutineRow[] = [];
    const facultyPool: FacultyDetail[] = [];

    for (const course of offeredCourses) {
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

      facultyPool.push(...facultyDetails);

      const batchCodes = uniqueStrings(
        course.offered_course_batches.map((item) => item.batches.batch_code)
      );

      for (const faculty of facultyDetails) {
        if (teacherId && faculty.id !== teacherId) {
          continue;
        }

        for (const slot of effectiveSlots) {
          if (dayOfWeek && normalize(slot.day_of_week) !== dayOfWeek) {
            continue;
          }

          allRows.push({
            faculty,
            programCode: course.offerings.programs.short_name,
            programName: course.offerings.programs.name,
            batchCodes,
            courseCode: course.master_courses.course_code,
            courseTitle: course.master_courses.course_title,
            section: course.section,
            dayOfWeek: slot.day_of_week,
            startTime: slot.start_time,
            endTime: slot.end_time,
            roomCode: slot.rooms?.room_code || "-",
            scheduleKind: detectScheduleKind(
              slot.slot_type,
              course.master_courses.course_title
            ),
          });
        }
      }
    }

    const facultyOptions = uniqueFaculty(facultyPool);
    const rows = allRows.sort(compareRows);

    return NextResponse.json({
      success: true,
      termName: term.name,
      facultyOptions,
      dayOptions: uniqueStrings(rows.map((row) => row.dayOfWeek)),
      rows,
    });
  } catch (error) {
    console.error("Public faculty schedule failed:", error);

    return NextResponse.json(
      { error: "Failed to load faculty-wise public schedule." },
      { status: 500 }
    );
  }
}
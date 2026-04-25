import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  REPORT_VISIBLE_OFFERING_STATUSES,
  normalizeReportParam,
} from "@/lib/report-visible-statuses";

type SlotRow = {
  offeredCourseId: number;
  programCode: string;
  programName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  credit: number;
  role: "PRIMARY" | "SECONDARY";
  primaryReference: string;
  batchCodes: string[];
  facultyText: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const termName = normalizeReportParam(searchParams.get("termName"));
    const programCode = normalizeReportParam(searchParams.get("programCode"));
    const batchCode = normalizeReportParam(searchParams.get("batchCode"));

    if (!termName) {
      return NextResponse.json({ error: "termName is required." }, { status: 400 });
    }

    const term = await prisma.academic_terms.findFirst({
      where: { name: termName },
      select: { id: true, name: true },
    });

    if (!term) {
      return NextResponse.json({ error: "Academic term not found." }, { status: 404 });
    }

    const courses = await prisma.offered_courses.findMany({
      where: {
        offerings: {
          academic_term_id: term.id,
          status: { in: REPORT_VISIBLE_OFFERING_STATUSES },
          ...(programCode
            ? {
                programs: {
                  short_name: programCode,
                },
              }
            : {}),
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
      orderBy: [
        { offerings: { program_id: "asc" } },
        { section: "asc" },
        { id: "asc" },
      ],
      include: {
        master_courses: { include: { program: true } },
        offered_course_batches: { include: { batches: true } },
        offered_course_slots: {
          orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
          include: { rooms: true },
        },
        offered_course_teachers: { include: { teachers: true } },
        primary_offered_course: {
          include: {
            master_courses: true,
            offered_course_slots: {
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
              include: { rooms: true },
            },
            offered_course_teachers: { include: { teachers: true } },
          },
        },
      },
    });

    const rows: SlotRow[] = [];

    for (const course of courses) {
      const effectiveSlots =
        course.primary_offered_course?.offered_course_slots.length
          ? course.primary_offered_course.offered_course_slots
          : course.offered_course_slots;

      const effectiveTeachers =
        course.primary_offered_course?.offered_course_teachers.length
          ? course.primary_offered_course.offered_course_teachers
          : course.offered_course_teachers;

      const facultyText =
        effectiveTeachers.length > 0
          ? uniqueStrings(
              effectiveTeachers.map(
                (row) => `${row.teachers.teacher_code} - ${row.teachers.full_name}`
              )
            ).join(", ")
          : "-";

      const baseRow = {
        offeredCourseId: course.id,
        programCode: course.master_courses.program.short_name,
        programName: course.master_courses.program.name,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        section: course.section,
        credit: Number(course.master_courses.credit || 0),
        role: course.primary_offered_course_id ? ("SECONDARY" as const) : ("PRIMARY" as const),
        primaryReference: course.primary_offered_course_id
          ? `${course.primary_offered_course?.master_courses.course_code || "-"} Sec-${course.primary_offered_course?.section || "-"}`
          : "-",
        batchCodes: uniqueStrings(course.offered_course_batches.map((x) => x.batches.batch_code)),
        facultyText,
      };

      if (effectiveSlots.length === 0) {
        rows.push({
          ...baseRow,
          dayOfWeek: "-",
          startTime: "-",
          endTime: "-",
          roomCode: "-",
        });
      } else {
        for (const slot of effectiveSlots) {
          rows.push({
            ...baseRow,
            dayOfWeek: slot.day_of_week,
            startTime: slot.start_time,
            endTime: slot.end_time,
            roomCode: slot.rooms?.room_code || "-",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      termName: term.name,
      filters: { programCode, batchCode },
      summary: {
        totalRows: rows.length,
        rowsWithRoom: rows.filter((row) => row.roomCode !== "-").length,
        rowsWithoutRoom: rows.filter((row) => row.roomCode === "-").length,
        rowsWithFaculty: rows.filter((row) => row.facultyText !== "-").length,
        rowsWithoutFaculty: rows.filter((row) => row.facultyText === "-").length,
      },
      rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load confirmed schedule report." },
      { status: 500 }
    );
  }
}
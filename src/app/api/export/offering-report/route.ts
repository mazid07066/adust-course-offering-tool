import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  autoWidth,
  styleAllBorders,
  styleHeaderRow,
  styleTitleRow,
  workbookToBuffer,
} from "@/lib/excel-export";

export const runtime = "nodejs";

function normalizeTermName(value: string) {
  return String(value || "").trim().toUpperCase();
}

function normalizeSeason(season: string): string {
  const s = season.trim().toLowerCase();
  if (s === "spring") return "SPRING";
  if (s === "summer") return "SUMMER";
  if (s === "fall") return "FALL";
  return season.trim().toUpperCase();
}

function buildTermName(season: string, year: string) {
  return `${normalizeSeason(season)} ${year.trim()}`;
}

function getRoomText(room: { room_code: string | null } | null) {
  return room?.room_code || "-";
}

export async function GET(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(request.url);

    const termNameParam = normalizeTermName(searchParams.get("termName") || "");
    const season = String(searchParams.get("season") || "").trim();
    const year = String(searchParams.get("year") || "").trim();
    const status = String(searchParams.get("status") || "").trim().toUpperCase();

    const termName =
      termNameParam || (season && year ? normalizeTermName(buildTermName(season, year)) : "");

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required. Example: ?termName=SUMMER%202026" },
        { status: 400 }
      );
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
        { error: `Academic term ${termName} was not found.` },
        { status: 404 }
      );
    }

    const offeredCourses = await prisma.offered_courses.findMany({
      where: {
        primary_offered_course_id: null,
        offerings: {
          academic_term_id: term.id,
          ...(status ? { status } : {}),
        },
      },
      include: {
        offerings: {
          include: {
            programs: {
              include: {
                departments: true,
              },
            },
            academic_terms: true,
          },
        },
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
      },
      orderBy: [
        { offering_id: "asc" },
        { section: "asc" },
        { id: "asc" },
      ],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "UniFlow Academic Planner";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Offering Report");

    ws.getCell("A1").value = `Offering Report - ${term.name}`;
    styleTitleRow(ws.getRow(1));

    ws.getCell("A2").value = status ? `Status Filter: ${status}` : "Status Filter: ALL";

    ws.addRow([]);

    const headerRowNumber = 4;

    ws.addRow([
      "SL",
      "Offering Status",
      "Primary Program",
      "Course Code",
      "Course Title",
      "Section",
      "Credit",
      "Batches",
      "Faculty",
      "Schedule",
      "Co-offered Courses",
      "Co-offered Batches",
    ]);

    styleHeaderRow(ws.getRow(headerRowNumber));

    offeredCourses.forEach((offeredCourse, index) => {
      const primaryCourse = offeredCourse.master_courses;

      const batchCodes = offeredCourse.offered_course_batches
        .map((row) => row.batches.batch_code)
        .join(", ");

      const facultyText =
        offeredCourse.offered_course_teachers.length > 0
          ? offeredCourse.offered_course_teachers
              .map((row) =>
                row.teachers
                  ? `${row.teachers.teacher_code} - ${row.teachers.full_name}`
                  : "-"
              )
              .join(", ")
          : "-";

      const scheduleText =
        offeredCourse.offered_course_slots.length > 0
          ? offeredCourse.offered_course_slots
              .map(
                (slot) =>
                  `${slot.day_of_week} ${slot.start_time}-${slot.end_time} | ${getRoomText(slot.rooms)}`
              )
              .join(" || ")
          : "-";

      const coofferedCourses =
        offeredCourse.secondary_offered_courses.length > 0
          ? offeredCourse.secondary_offered_courses
              .map(
                (secondary) =>
                  `${secondary.master_courses.program.short_name} ${secondary.master_courses.course_code} Sec-${secondary.section}`
              )
              .join(", ")
          : "-";

      const coofferedBatches =
        offeredCourse.secondary_offered_courses.length > 0
          ? [
              ...new Set(
                offeredCourse.secondary_offered_courses.flatMap((secondary) =>
                  secondary.offered_course_batches.map(
                    (row) => row.batches.batch_code
                  )
                )
              ),
            ].join(", ")
          : "-";

      ws.addRow([
        index + 1,
        offeredCourse.offerings.status,
        primaryCourse.program.short_name,
        primaryCourse.course_code,
        primaryCourse.course_title,
        offeredCourse.section,
        Number(primaryCourse.credit || 0),
        batchCodes || "-",
        facultyText,
        scheduleText,
        coofferedCourses,
        coofferedBatches,
      ]);
    });

    if (offeredCourses.length === 0) {
      ws.addRow([
        "-",
        "-",
        "-",
        "-",
        "No offered courses found for this term.",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
      ]);
    }

    styleAllBorders(ws, headerRowNumber, headerRowNumber + Math.max(offeredCourses.length, 1), 12);
    autoWidth(ws, [8, 22, 20, 18, 40, 12, 10, 22, 36, 42, 38, 26]);

    const buffer = await workbookToBuffer(workbook);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="offering_report_${term.name.replace(
          /\s+/g,
          "_"
        )}.xlsx"`,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export offering report.",
      },
      { status: 500 }
    );
  }
}
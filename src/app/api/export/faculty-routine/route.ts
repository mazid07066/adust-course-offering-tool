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

const DAYS = ["THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "MONDAY"];

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

function safeWorksheetName(name: string) {
  const cleaned = String(name || "Faculty")
    .replace(/[\\/?*[\]:]/g, "-")
    .slice(0, 31);

  return cleaned || "Faculty";
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

    const teacherIdRaw = String(
      searchParams.get("teacherId") || searchParams.get("facultyId") || ""
    ).trim();

    const teacherId = teacherIdRaw ? Number(teacherIdRaw) : null;

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

    const teachers = await prisma.teachers.findMany({
      where: {
        is_active: true,
        ...(teacherId ? { id: teacherId } : {}),
      },
      include: {
        departments: true,
      },
      orderBy: [{ teacher_code: "asc" }],
    });

    if (teachers.length === 0) {
      return NextResponse.json(
        { error: "No active faculty found for this export." },
        { status: 404 }
      );
    }

    const assignments = await prisma.offered_course_teachers.findMany({
      where: {
        ...(teacherId ? { teacher_id: teacherId } : {}),
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
          },
        },
      },
      include: {
        teachers: {
          include: {
            departments: true,
          },
        },
        offered_courses: {
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
            offered_course_slots: {
              include: {
                rooms: true,
              },
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
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
        },
      },
      orderBy: [{ teacher_id: "asc" }, { offered_course_id: "asc" }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "UniFlow Academic Planner";
    workbook.created = new Date();

    for (const teacher of teachers) {
      const teacherAssignments = assignments.filter(
        (assignment) => assignment.teacher_id === teacher.id
      );

      const ws = workbook.addWorksheet(
        safeWorksheetName(`${teacher.teacher_code}-${teacher.id}`)
      );

      let rowNo = 1;

      ws.getCell(`A${rowNo}`).value = `Faculty Routine - ${teacher.teacher_code} - ${teacher.full_name} - ${term.name}`;
      styleTitleRow(ws.getRow(rowNo));
      rowNo += 2;

      ws.getCell(`A${rowNo}`).value = `Designation: ${teacher.designation || "-"}`;
      rowNo += 1;

      ws.getCell(`A${rowNo}`).value = `Department: ${
        teacher.departments?.short_name || "-"
      }`;
      rowNo += 1;

      ws.getCell(`A${rowNo}`).value = `Phone: ${teacher.phone || "-"}`;
      rowNo += 1;

      ws.getCell(`A${rowNo}`).value = `Email: ${teacher.email || "-"}`;
      rowNo += 2;

      for (const day of DAYS) {
        ws.getCell(`A${rowNo}`).value = day;
        ws.getRow(rowNo).font = { bold: true, size: 12 };
        rowNo += 1;

        ws.addRow(["Time", "Course Codes", "Title", "Section", "Batch", "Room"]);
        styleHeaderRow(ws.getRow(rowNo));

        const headerRow = rowNo;
        rowNo += 1;

        const rows = teacherAssignments.flatMap((assignment) => {
          const offeredCourse = assignment.offered_courses;
          const course = offeredCourse.master_courses;

          const secondaryCodes = offeredCourse.secondary_offered_courses.map(
            (secondary) => secondary.master_courses.course_code
          );

          const displayCourseCodes =
            secondaryCodes.length > 0
              ? [course.course_code, ...secondaryCodes].join(" / ")
              : course.course_code;

          const batchCodes = [
            ...new Set([
              ...offeredCourse.offered_course_batches.map(
                (row) => row.batches.batch_code
              ),
              ...offeredCourse.secondary_offered_courses.flatMap((secondary) =>
                secondary.offered_course_batches.map(
                  (row) => row.batches.batch_code
                )
              ),
            ]),
          ].join(", ");

          return offeredCourse.offered_course_slots
            .filter((slot) => slot.day_of_week === day)
            .map((slot) => ({
              time: `${slot.start_time}-${slot.end_time}`,
              courseCodes: displayCourseCodes,
              title: course.course_title,
              section: offeredCourse.section,
              batch: batchCodes || "-",
              room: getRoomText(slot.rooms),
            }));
        });

        rows.sort((a, b) => a.time.localeCompare(b.time));

        if (rows.length === 0) {
          ws.addRow(["-", "-", "No class", "-", "-", "-"]);
          rowNo += 1;
        } else {
          for (const item of rows) {
            ws.addRow([
              item.time,
              item.courseCodes,
              item.title,
              item.section,
              item.batch,
              item.room,
            ]);
            rowNo += 1;
          }
        }

        styleAllBorders(ws, headerRow, rowNo - 1, 6);
        rowNo += 1;
      }

      autoWidth(ws, [18, 24, 38, 12, 22, 14]);
    }

    const buffer = await workbookToBuffer(workbook);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="faculty_routine_${term.name.replace(
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
            : "Failed to export faculty routine.",
      },
      { status: 500 }
    );
  }
}
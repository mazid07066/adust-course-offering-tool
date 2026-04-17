import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  autoWidth,
  styleAllBorders,
  styleHeaderRow,
  styleTitleRow,
  workbookToBuffer,
} from "@/lib/excel-export";

export const runtime = "nodejs";

const DAYS = ["SUN", "MON", "THU"];

function normalizeSeason(season: string): string {
  const s = season.trim().toLowerCase();
  if (s === "spring") return "SPRING";
  if (s === "summer") return "SUMMER";
  if (s === "fall") return "FALL";
  throw new Error("Season must be spring, summer, or fall.");
}

function buildSemesterTitle(season: string, year: string) {
  return `${normalizeSeason(season)} ${year.trim()}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const season = String(searchParams.get("season") || "").trim();
    const year = String(searchParams.get("year") || "").trim();
    const facultyId = String(searchParams.get("facultyId") || "").trim();

    if (!season || !year) {
      return NextResponse.json(
        { error: "season and year are required." },
        { status: 400 }
      );
    }

    const semesterTitle = buildSemesterTitle(season, year);
    const semesterCode = semesterTitle.replace(/\s+/g, "-");

    const semester = await prisma.semester.findUnique({
      where: { code: semesterCode },
    });

    if (!semester) {
      return NextResponse.json({ error: "Semester not found." }, { status: 404 });
    }

    const faculties = await prisma.faculty.findMany({
      where: {
        isActive: true,
        ...(facultyId ? { id: facultyId } : {}),
      },
      include: {
        department: true,
      },
      orderBy: [{ initial: "asc" }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ADUST Course Offering Tool";
    workbook.created = new Date();

    for (const faculty of faculties) {
      const offerings = await prisma.offering.findMany({
        where: {
          semesterId: semester.id,
          facultyId: faculty.id,
        },
        include: {
          course: {
            include: {
              program: true,
            },
          },
          room: true,
          slots: true,
          offeringBatches: {
            include: {
              batch: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const ws = workbook.addWorksheet(faculty.initial);

      let rowNo = 1;
      ws.getCell(`A${rowNo}`).value = `Faculty Routine - ${faculty.initial} - ${faculty.name} - ${semester.title}`;
      styleTitleRow(ws.getRow(rowNo));
      rowNo += 2;

      ws.getCell(`A${rowNo}`).value = `Designation: ${faculty.designation ?? "-"}`;
      rowNo += 1;
      ws.getCell(`A${rowNo}`).value = `Department: ${faculty.department.code}`;
      rowNo += 1;
      ws.getCell(`A${rowNo}`).value = `Phone: ${faculty.phone ?? "-"}`;
      rowNo += 1;
      ws.getCell(`A${rowNo}`).value = `Email: ${faculty.email ?? "-"}`;
      rowNo += 2;

      for (const day of DAYS) {
        ws.getCell(`A${rowNo}`).value = day;
        ws.getRow(rowNo).font = { bold: true, size: 12 };
        rowNo += 1;

        ws.addRow([
          "Time",
          "Course Codes",
          "Title",
          "Section",
          "Batch",
          "Room",
        ]);
        styleHeaderRow(ws.getRow(rowNo));
        const headerRow = rowNo;
        rowNo += 1;

        const rows = offerings.flatMap((offering) =>
          offering.slots
            .filter((slot) => slot.dayOfWeek === day)
            .map((slot) => ({
              time: `${slot.startTime}-${slot.endTime}`,
              courseCodes: offering.coOfferedCourseCode
                ? `${offering.course.code} / ${offering.coOfferedCourseCode}`
                : offering.course.code,
              title: offering.course.title,
              section: offering.section,
              batch: offering.offeringBatches.map((ob) => ob.batch.code).join(", "),
              room: offering.room?.roomCode ?? "-",
            }))
        );

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

      autoWidth(ws, [18, 22, 34, 12, 18, 12]);
    }

    const buffer = await workbookToBuffer(workbook);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="faculty_routine_${semester.code}.xlsx"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export faculty routine." },
      { status: 500 }
    );
  }
}
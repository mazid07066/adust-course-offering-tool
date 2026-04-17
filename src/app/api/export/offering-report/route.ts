import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  addFacultyDetailsSection,
  autoWidth,
  styleAllBorders,
  styleHeaderRow,
  styleTitleRow,
  workbookToBuffer,
} from "@/lib/excel-export";

export const runtime = "nodejs";

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
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(request.url);

    const season = String(searchParams.get("season") || "").trim();
    const year = String(searchParams.get("year") || "").trim();

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

    const offerings = await prisma.offering.findMany({
      where: { semesterId: semester.id },
      include: {
        course: {
          include: {
            program: true,
          },
        },
        faculty: {
          include: {
            department: true,
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

    const facultyDetails = offerings
      .filter((o) => o.faculty)
      .map((o) => o.faculty!)
      .reduce<
        {
          id: string;
          initial: string;
          name: string;
          designation: string | null;
          departmentCode: string;
          phone: string | null;
          email: string | null;
        }[]
      >((acc, faculty) => {
        if (!acc.find((f) => f.id === faculty.id)) {
          acc.push({
            id: faculty.id,
            initial: faculty.initial,
            name: faculty.name,
            designation: faculty.designation,
            departmentCode: faculty.department.code,
            phone: faculty.phone,
            email: faculty.email,
          });
        }
        return acc;
      }, []);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ADUST Course Offering Tool";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Offering Report");

    let rowNo = 1;
    ws.getCell(`A${rowNo}`).value = `Offering Report - ${semester.title}`;
    styleTitleRow(ws.getRow(rowNo));
    rowNo += 2;

    ws.addRow([
      "Department",
      "Main Course Code",
      "Co-offered Course Code",
      "Course Title",
      "Section",
      "Batches",
      "Faculty Initial",
      "Faculty Name",
      "Room",
      "Schedule",
      "Credit",
    ]);
    styleHeaderRow(ws.getRow(rowNo));
    const headerRow = rowNo;
    rowNo += 1;

    for (const offering of offerings) {
      ws.addRow([
        offering.course.program.code,
        offering.course.code,
        offering.coOfferedCourseCode ?? "-",
        offering.course.title,
        offering.section,
        offering.offeringBatches.map((ob) => ob.batch.code).join(", "),
        offering.faculty?.initial ?? "-",
        offering.faculty?.name ?? "-",
        offering.room?.roomCode ?? "-",
        offering.slots.map((s) => `${s.dayOfWeek} ${s.startTime}-${s.endTime}`).join("; "),
        offering.course.creditHours,
      ]);
      rowNo += 1;
    }

    styleAllBorders(ws, headerRow, rowNo - 1, 11);
    autoWidth(ws, [14, 18, 20, 34, 10, 18, 14, 26, 12, 28, 10]);

    addFacultyDetailsSection(ws, rowNo + 2, facultyDetails);

    const buffer = await workbookToBuffer(workbook);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="offering_report_${semester.code}.xlsx"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export offering report." },
      { status: 500 }
    );
  }
}
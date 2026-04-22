import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireFacultyApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  styleHeaderRow,
  styleAllBorders,
  workbookToBuffer,
} from "@/lib/excel-export";

function isLabCourse(title: string, courseType: string | null | undefined) {
  const t = String(title || "").toUpperCase();
  const ct = String(courseType || "").toUpperCase();
  return t.includes("LAB") || ct.includes("LAB");
}

function isProjectLikeCourse(title: string, courseType: string | null | undefined) {
  const t = String(title || "").toUpperCase();
  const ct = String(courseType || "").toUpperCase();
  return (
    t.includes("PROJECT") ||
    t.includes("INTERNSHIP") ||
    t.includes("THESIS") ||
    ct.includes("PROJECT")
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        { error: "Faculty account is not linked to a teacher record." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const [teacher, term] = await Promise.all([
      prisma.teachers.findUnique({
        where: { id: guard.teacher_id },
        include: {
          departments: true,
        },
      }),
      prisma.academic_terms.findFirst({
        where: { name: termName },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!teacher) {
      return NextResponse.json(
        { error: "Faculty record not found." },
        { status: 404 }
      );
    }

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const selections = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
        status: "FINAL",
      },
      include: {
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
          },
        },
      },
      orderBy: [{ priority_order: "asc" }, { id: "asc" }],
    });

    let totalTheoryCredits = 0;
    let totalLabCredits = 0;

    const tallyMap = new Map<
      string,
      { programCode: string; theoryCredits: number; labCredits: number; totalCredits: number }
    >();

    const scheduleRows: Array<{
      courseCode: string;
      section: string;
      credit: number;
      day: string;
      time: string;
      room: string;
      category: string;
    }> = [];

    const submissionAt =
      selections
        .map((row) => row.confirmed_at || row.selected_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b as Date).getTime() - new Date(a as Date).getTime())[0] ||
      null;

    for (const row of selections) {
      const course = row.offered_courses;
      const master = course.master_courses;
      const credit = Number(master.credit || 0);

      const category = isProjectLikeCourse(master.course_title, master.course_type)
        ? "PROJECT"
        : isLabCourse(master.course_title, master.course_type)
        ? "LAB"
        : "THEORY";

      if (category === "LAB") {
        totalLabCredits += credit;
      } else {
        totalTheoryCredits += credit;
      }

      const programCode = master.program.short_name;
      if (!tallyMap.has(programCode)) {
        tallyMap.set(programCode, {
          programCode,
          theoryCredits: 0,
          labCredits: 0,
          totalCredits: 0,
        });
      }

      const tally = tallyMap.get(programCode)!;
      if (category === "LAB") tally.labCredits += credit;
      else tally.theoryCredits += credit;
      tally.totalCredits += credit;

      if (course.offered_course_slots.length === 0) {
        scheduleRows.push({
          courseCode: master.course_code,
          section: course.section,
          credit,
          day: "-",
          time: "-",
          room: "-",
          category,
        });
      } else {
        for (const slot of course.offered_course_slots) {
          scheduleRows.push({
            courseCode: master.course_code,
            section: course.section,
            credit,
            day: slot.day_of_week,
            time: `${slot.start_time} - ${slot.end_time}`,
            room: slot.rooms?.room_code || "-",
            category,
          });
        }
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ADUST Course Offering Tool";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Faculty Load Sheet");

    ws.pageSetup = {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    };

    let row = 1;

    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = "Faculty Load Sheet";
    ws.getCell(`A${row}`).font = { bold: true, size: 16 };
    ws.getCell(`A${row}`).alignment = { horizontal: "center" };
    row += 2;

    ws.getCell(`A${row}`).value = "Faculty's Department:";
    ws.getCell(`B${row}`).value = `${teacher.departments?.short_name || "-"} | ${teacher.departments?.name || "-"}`;
    ws.getCell(`E${row}`).value = "Semester for given choices:";
    ws.getCell(`F${row}`).value = term.name;
    row += 1;

    ws.getCell(`A${row}`).value = "Faculty's Full Name:";
    ws.getCell(`B${row}`).value = teacher.full_name;
    ws.getCell(`E${row}`).value = "Faculty's Designation:";
    ws.getCell(`F${row}`).value = teacher.designation || "-";
    row += 1;

    ws.getCell(`A${row}`).value = "Faculty's Initial:";
    ws.getCell(`B${row}`).value = teacher.teacher_code;
    ws.getCell(`E${row}`).value = "Date and time of submission:";
    ws.getCell(`F${row}`).value = submissionAt ? new Date(submissionAt).toLocaleString() : "-";
    row += 1;

    ws.getCell(`A${row}`).value = "Total theory credits taken:";
    ws.getCell(`B${row}`).value = totalTheoryCredits;
    ws.getCell(`E${row}`).value = "Total lab credits taken:";
    ws.getCell(`F${row}`).value = totalLabCredits;
    row += 2;

    ws.getCell(`A${row}`).value = "Total credits from which programs";
    ws.getCell(`A${row}`).font = { bold: true, size: 12 };
    row += 1;

    ws.getRow(row).values = ["Program", "Theory Credits", "Lab Credits", "Total Credits"];
    styleHeaderRow(ws.getRow(row));
    const tallyHeaderRow = row;
    row += 1;

    for (const tally of Array.from(tallyMap.values()).sort((a, b) =>
      a.programCode.localeCompare(b.programCode)
    )) {
      ws.getRow(row).values = [
        tally.programCode,
        tally.theoryCredits,
        tally.labCredits,
        tally.totalCredits,
      ];
      row += 1;
    }

    styleAllBorders(ws, tallyHeaderRow, row - 1, 4);
    row += 1;

    ws.getCell(`A${row}`).value = "Full schedule of the courses";
    ws.getCell(`A${row}`).font = { bold: true, size: 12 };
    row += 1;

    ws.getRow(row).values = [
      "Course Code",
      "Section",
      "Credit",
      "Day",
      "Time",
      "Room",
      "Category",
    ];
    styleHeaderRow(ws.getRow(row));
    const scheduleHeaderRow = row;
    row += 1;

    for (const item of scheduleRows) {
      ws.getRow(row).values = [
        item.courseCode,
        item.section,
        item.credit,
        item.day,
        item.time,
        item.room,
        item.category,
      ];
      row += 1;
    }

    if (scheduleRows.length === 0) {
      ws.getRow(row).values = ["No finalized courses found."];
      row += 1;
    }

    styleAllBorders(ws, scheduleHeaderRow, row - 1, 7);
    row += 2;

    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`A${row}`).value = "______________________________";
    row += 1;
    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`A${row}`).value = teacher.full_name;
    row += 1;
    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`A${row}`).value = "Faculty Signature";

    ws.columns = [
      { width: 18 },
      { width: 14 },
      { width: 10 },
      { width: 14 },
      { width: 22 },
      { width: 14 },
      { width: 14 },
    ];

    const buffer = await workbookToBuffer(workbook);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="faculty_load_sheet_${teacher.teacher_code}_${term.name.replace(/\s+/g, "_")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to export faculty load sheet." },
      { status: 500 }
    );
  }
}
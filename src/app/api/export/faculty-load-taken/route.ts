import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getFacultyLoadRowsForReporting } from "@/lib/reporting-data";
import {
  createWorkbook,
  setupWorksheet,
  applyHeaderStyle,
  applyDataStyle,
} from "@/lib/reporting-excel";

function safeFileName(value: string) {
  return value.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_");
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const termName = String(searchParams.get("termName") || "").trim();
    const programCode = String(searchParams.get("programCode") || "").trim();
    const batchCode = String(searchParams.get("batchCode") || "").trim();
    const teacherCode = String(searchParams.get("teacherCode") || "").trim();

    if (!termName) {
      return NextResponse.json({ error: "termName is required." }, { status: 400 });
    }

    const rows = await getFacultyLoadRowsForReporting({
      termName,
      programCode: programCode || undefined,
      batchCode: batchCode || undefined,
      teacherCode: teacherCode || undefined,
    });

    const workbook = await createWorkbook();
    const sheet = setupWorksheet(workbook, "Faculty Load Taken");

    sheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.2,
        footer: 0.2,
      },
      printTitlesRow: "1:5",
    };

    sheet.mergeCells("A1:L1");
    sheet.getCell("A1").value = "UniFlow Academic Planner";
    sheet.getCell("A1").font = { bold: true, size: 16 };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells("A2:L2");
    sheet.getCell("A2").value = `Faculty Load Taken Report — ${termName.toUpperCase()}`;
    sheet.getCell("A2").font = { bold: true, size: 14 };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells("A3:L3");
    sheet.getCell("A3").value = `Program: ${programCode || "All"} | Batch: ${
      batchCode || "All"
    } | Faculty: ${teacherCode || "All"}`;
    sheet.getCell("A3").font = { italic: true, size: 10 };
    sheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

    sheet.addRow([]);

    sheet.addRow([
      "Faculty Initial",
      "Faculty Name",
      "Department",
      "Program",
      "Batch",
      "Course Code",
      "Course Title",
      "Section",
      "Assigned Credit",
      "Load Type",
      "Schedule",
      "Offering Status",
    ]);
    applyHeaderStyle(sheet.getRow(5));
    sheet.views = [{ state: "frozen", ySplit: 5 }];

    for (const faculty of rows) {
      const groupRow = sheet.addRow([
        `${faculty.teacherCode} - ${faculty.teacherName}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        `Total: ${faculty.totalCredits}`,
        "",
        "",
        "",
      ]);

      groupRow.font = { bold: true };
      groupRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEEF2FF" },
      };

      for (const course of faculty.assignedCourses) {
        const excelRow = sheet.addRow([
          faculty.teacherCode,
          faculty.teacherName,
          faculty.departmentCode,
          course.programCode,
          course.batchCodes.join(", ") || "-",
          course.courseCode,
          course.courseTitle,
          course.section,
          course.assignedCredit,
          course.loadType,
          course.scheduleText,
          course.offeringStatus,
        ]);

        applyDataStyle(excelRow);
      }

      sheet.addRow([]);
    }

    if (!rows.length) {
      const emptyRow = sheet.addRow(["No faculty load rows found."]);
      sheet.mergeCells(`A${emptyRow.number}:L${emptyRow.number}`);
      emptyRow.getCell(1).alignment = { horizontal: "center" };
    }

    sheet.columns = [
      { key: "teacherCode", width: 16 },
      { key: "teacherName", width: 28 },
      { key: "department", width: 16 },
      { key: "program", width: 18 },
      { key: "batch", width: 18 },
      { key: "courseCode", width: 16 },
      { key: "courseTitle", width: 40 },
      { key: "section", width: 10 },
      { key: "assignedCredit", width: 16 },
      { key: "loadType", width: 16 },
      { key: "schedule", width: 40 },
      { key: "status", width: 22 },
    ];

    sheet.eachRow((row) => {
      row.height = 24;
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFileName(
          termName
        )}_faculty_load_taken.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Faculty load taken export failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export faculty load taken report.",
      },
      { status: 500 }
    );
  }
}
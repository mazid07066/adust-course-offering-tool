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
    const sheet = setupWorksheet(workbook, "Faculty Load Combined");

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

    sheet.mergeCells("A1:K1");
    sheet.getCell("A1").value = "UniFlow Academic Planner";
    sheet.getCell("A1").font = { bold: true, size: 16 };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells("A2:K2");
    sheet.getCell("A2").value = `Combined Faculty Load Report — ${termName.toUpperCase()}`;
    sheet.getCell("A2").font = { bold: true, size: 14 };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells("A3:K3");
    sheet.getCell("A3").value = `Program: ${programCode || "All"} | Batch: ${
      batchCode || "All"
    } | Faculty: ${teacherCode || "All"}`;
    sheet.getCell("A3").font = { italic: true, size: 10 };
    sheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

    sheet.addRow([]);

    sheet.addRow([
      "Faculty Initial",
      "Faculty Name",
      "Designation",
      "Department",
      "Seniority",
      "Theory Credit",
      "Lab Credit",
      "Project Credit",
      "Total Credit",
      "Phone",
      "Email",
    ]);
    applyHeaderStyle(sheet.getRow(5));
    sheet.views = [{ state: "frozen", ySplit: 5 }];

    for (const row of rows) {
      const excelRow = sheet.addRow([
        row.teacherCode,
        row.teacherName,
        row.designation,
        row.departmentCode,
        row.seniorityLevel ?? "-",
        row.theoryCredits,
        row.labCredits,
        row.projectCredits,
        row.totalCredits,
        row.phone,
        row.email,
      ]);

      applyDataStyle(excelRow);
    }

    const totalRow = sheet.addRow([
      "TOTAL",
      "",
      "",
      "",
      "",
      rows.reduce((sum, row) => sum + row.theoryCredits, 0),
      rows.reduce((sum, row) => sum + row.labCredits, 0),
      rows.reduce((sum, row) => sum + row.projectCredits, 0),
      rows.reduce((sum, row) => sum + row.totalCredits, 0),
      "",
      "",
    ]);

    totalRow.font = { bold: true };
    applyDataStyle(totalRow);

    sheet.columns = [
      { key: "teacherCode", width: 16 },
      { key: "teacherName", width: 30 },
      { key: "designation", width: 24 },
      { key: "department", width: 16 },
      { key: "seniority", width: 12 },
      { key: "theoryCredits", width: 14 },
      { key: "labCredits", width: 14 },
      { key: "projectCredits", width: 14 },
      { key: "totalCredits", width: 14 },
      { key: "phone", width: 18 },
      { key: "email", width: 30 },
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
        )}_faculty_load_combined.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Faculty load combined export failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export faculty load combined report.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getOfferingSummaryRowsForReporting } from "@/lib/reporting-data";
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

    if (!termName) {
      return NextResponse.json({ error: "termName is required." }, { status: 400 });
    }

    const rows = await getOfferingSummaryRowsForReporting({
      termName,
      programCode: programCode || undefined,
      batchCode: batchCode || undefined,
    });

    const workbook = await createWorkbook();
    const sheet = setupWorksheet(workbook, "Offering Summary");

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

    sheet.mergeCells("A1:M1");
    sheet.getCell("A1").value = "UniFlow Academic Planner";
    sheet.getCell("A1").font = { bold: true, size: 16 };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells("A2:M2");
    sheet.getCell("A2").value = `Offering Summary Report — ${termName.toUpperCase()}`;
    sheet.getCell("A2").font = { bold: true, size: 14 };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells("A3:M3");
    sheet.getCell("A3").value = `Program: ${programCode || "All"} | Batch: ${
      batchCode || "All"
    }`;
    sheet.getCell("A3").font = { italic: true, size: 10 };
    sheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

    sheet.addRow([]);

    sheet.addRow([
      "Status",
      "Role",
      "Program",
      "Batch",
      "Course Code",
      "Course Title",
      "Course Type",
      "Section",
      "Credit",
      "Faculty",
      "Schedule",
      "Primary Reference",
      "Co-offered With",
    ]);
    applyHeaderStyle(sheet.getRow(5));
    sheet.views = [{ state: "frozen", ySplit: 5 }];

    for (const row of rows) {
      const excelRow = sheet.addRow([
        row.offeringStatus,
        row.role,
        row.programCode,
        row.batchCodes.join(", ") || "-",
        row.courseCode,
        row.courseTitle,
        row.courseType,
        row.section,
        row.credit,
        row.facultyText,
        row.scheduleText,
        row.primaryReference,
        row.coOfferedCourseText,
      ]);

      applyDataStyle(excelRow);
    }

    if (!rows.length) {
      const emptyRow = sheet.addRow(["No offering summary rows found."]);
      sheet.mergeCells(`A${emptyRow.number}:M${emptyRow.number}`);
      emptyRow.getCell(1).alignment = { horizontal: "center" };
    }

    sheet.columns = [
      { key: "status", width: 22 },
      { key: "role", width: 12 },
      { key: "program", width: 18 },
      { key: "batch", width: 18 },
      { key: "courseCode", width: 16 },
      { key: "courseTitle", width: 42 },
      { key: "courseType", width: 18 },
      { key: "section", width: 10 },
      { key: "credit", width: 10 },
      { key: "faculty", width: 35 },
      { key: "schedule", width: 42 },
      { key: "primaryReference", width: 22 },
      { key: "coOfferedWith", width: 36 },
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
        )}_offering_summary.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Offering summary export failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export offering summary report.",
      },
      { status: 500 }
    );
  }
}
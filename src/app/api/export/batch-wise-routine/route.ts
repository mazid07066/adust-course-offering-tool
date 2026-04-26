import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getScheduleRowsForReporting } from "@/lib/reporting-data";
import {
  createWorkbook,
  setupWorksheet,
  applyHeaderStyle,
  applyDataStyle,
} from "@/lib/reporting-excel";
import { DAY_ORDER, uniqueStrings } from "@/lib/report-visible-statuses";

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
    const scheduleKind = String(searchParams.get("scheduleKind") || "ALL").trim();

    if (!termName) {
      return NextResponse.json({ error: "termName is required." }, { status: 400 });
    }

    const rows = await getScheduleRowsForReporting({
      termName,
      programCode: programCode || undefined,
      batchCode: batchCode || undefined,
      scheduleKind:
        scheduleKind === "CLASS" || scheduleKind === "LAB" || scheduleKind === "PROJECT"
          ? scheduleKind
          : "ALL",
    });

    const workbook = await createWorkbook();
    const batches = uniqueStrings(rows.flatMap((row) => row.batchCodes)).sort();

    const targetBatches = batchCode ? [batchCode] : batches;

    for (const batch of targetBatches) {
      const batchRows = rows.filter((row) => row.batchCodes.includes(batch));
      const sheet = setupWorksheet(workbook, safeFileName(`Batch ${batch}`).slice(0, 31));

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

      sheet.mergeCells("A1:J1");
      sheet.getCell("A1").value = "UniFlow Academic Planner";
      sheet.getCell("A1").font = { bold: true, size: 16 };
      sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

      sheet.mergeCells("A2:J2");
      sheet.getCell("A2").value = `Batch-wise Routine — Batch ${batch}`;
      sheet.getCell("A2").font = { bold: true, size: 14 };
      sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

      sheet.mergeCells("A3:J3");
      sheet.getCell("A3").value = `Term: ${termName.toUpperCase()} | Program: ${
        programCode || "All"
      } | Schedule Type: ${scheduleKind || "ALL"}`;
      sheet.getCell("A3").font = { italic: true, size: 10 };
      sheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

      sheet.addRow([]);

      sheet.addRow([
        "Day",
        "Time",
        "Room",
        "Program",
        "Course Code",
        "Course Title",
        "Section",
        "Credit",
        "Faculty",
        "Type",
      ]);
      applyHeaderStyle(sheet.getRow(5));
      sheet.views = [{ state: "frozen", ySplit: 5 }];

      const sortedDays = uniqueStrings(batchRows.map((row) => row.dayOfWeek))
        .filter((day) => day !== "-")
        .sort((a, b) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99));

      let currentRow = 6;

      for (const day of sortedDays) {
        sheet.mergeCells(`A${currentRow}:J${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = day;
        sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
        sheet.getCell(`A${currentRow}`).alignment = {
          horizontal: "center",
          vertical: "middle",
        };
        sheet.getCell(`A${currentRow}`).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEEF2FF" },
        };
        currentRow += 1;

        for (const row of batchRows.filter((row) => row.dayOfWeek === day)) {
          const excelRow = sheet.addRow([
            row.dayOfWeek,
            `${row.startTime} - ${row.endTime}`,
            row.roomCode,
            row.programCode,
            row.courseCode,
            row.courseTitle,
            row.section,
            row.credit,
            row.facultyText,
            row.scheduleKind,
          ]);

          applyDataStyle(excelRow);
          currentRow += 1;
        }

        sheet.addRow([]);
        currentRow += 1;
      }

      if (!batchRows.length) {
        const emptyRow = sheet.addRow(["No routine rows found for this batch."]);
        sheet.mergeCells(`A${emptyRow.number}:J${emptyRow.number}`);
        emptyRow.getCell(1).alignment = { horizontal: "center" };
      }

      sheet.columns = [
        { key: "day", width: 14 },
        { key: "time", width: 18 },
        { key: "room", width: 14 },
        { key: "program", width: 18 },
        { key: "courseCode", width: 16 },
        { key: "courseTitle", width: 40 },
        { key: "section", width: 10 },
        { key: "credit", width: 10 },
        { key: "faculty", width: 35 },
        { key: "type", width: 12 },
      ];

      sheet.eachRow((row) => {
        row.height = 24;
      });
    }

    if (!targetBatches.length) {
      const sheet = setupWorksheet(workbook, "Batch Routine");
      sheet.addRow(["No batch routine rows found."]);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFileName(
          termName
        )}_batch_wise_routine.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Batch-wise routine export failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export batch-wise routine.",
      },
      { status: 500 }
    );
  }
}
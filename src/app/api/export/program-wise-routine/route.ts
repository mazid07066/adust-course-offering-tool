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
    const programs = uniqueStrings(rows.map((row) => row.programCode)).sort();
    const targetPrograms = programCode ? [programCode] : programs;

    for (const program of targetPrograms) {
      /*
       * When a programCode is supplied, getScheduleRowsForReporting()
       * has already applied UniFlow's academic/canonical program
       * identity matching.
       *
       * Do not compare row.programCode to the selected catalog code
       * again here. RAE NEW/OLD currently use a shared canonical
       * operational/reporting identity, so an exact comparison would
       * incorrectly remove valid rows from the Excel export.
       *
       * When no program is selected, retain normal per-program
       * worksheet grouping.
       */
      const programRows = programCode
        ? rows
        : rows.filter((row) => row.programCode === program);
      const sheet = setupWorksheet(workbook, safeFileName(program).slice(0, 31));

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
      sheet.getCell("A2").value = `Program-wise Complete Routine â€” ${program}`;
      sheet.getCell("A2").font = { bold: true, size: 14 };
      sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

      sheet.mergeCells("A3:K3");
      sheet.getCell("A3").value = `Term: ${termName.toUpperCase()} | Batch: ${
        batchCode || "All"
      } | Schedule Type: ${scheduleKind || "ALL"}`;
      sheet.getCell("A3").font = { italic: true, size: 10 };
      sheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

      sheet.addRow([]);

      sheet.addRow([
        "Day",
        "Time",
        "Room",
        "Batch",
        "Course Code",
        "Course Title",
        "Section",
        "Credit",
        "Faculty",
        "Type",
        "Status",
      ]);
      applyHeaderStyle(sheet.getRow(5));
      sheet.views = [{ state: "frozen", ySplit: 5 }];

      const sortedDays = uniqueStrings(programRows.map((row) => row.dayOfWeek))
        .filter((day) => day !== "-")
        .sort((a, b) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99));

      let currentRow = 6;

      for (const day of sortedDays) {
        sheet.mergeCells(`A${currentRow}:K${currentRow}`);
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

        for (const row of programRows.filter((row) => row.dayOfWeek === day)) {
          const excelRow = sheet.addRow([
            row.dayOfWeek,
            `${row.startTime} - ${row.endTime}`,
            row.roomCode,
            row.batchCodes.join(", ") || "-",
            row.courseCode,
            row.courseTitle,
            row.section,
            row.credit,
            row.facultyText,
            row.scheduleKind,
            row.offeringStatus,
          ]);

          applyDataStyle(excelRow);
          currentRow += 1;
        }

        sheet.addRow([]);
        currentRow += 1;
      }

      if (!programRows.length) {
        const emptyRow = sheet.addRow(["No routine rows found for this program."]);
        sheet.mergeCells(`A${emptyRow.number}:K${emptyRow.number}`);
        emptyRow.getCell(1).alignment = { horizontal: "center" };
      }

      sheet.columns = [
        { key: "day", width: 14 },
        { key: "time", width: 18 },
        { key: "room", width: 14 },
        { key: "batch", width: 18 },
        { key: "courseCode", width: 16 },
        { key: "courseTitle", width: 40 },
        { key: "section", width: 10 },
        { key: "credit", width: 10 },
        { key: "faculty", width: 35 },
        { key: "type", width: 12 },
        { key: "status", width: 22 },
      ];

      sheet.eachRow((row) => {
        row.height = 24;
      });
    }

    if (!targetPrograms.length) {
      const sheet = setupWorksheet(workbook, "Program Routine");
      sheet.addRow(["No program routine rows found."]);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFileName(
          termName
        )}_program_wise_routine.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Program-wise routine export failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export program-wise routine.",
      },
      { status: 500 }
    );
  }
}

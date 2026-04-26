import ExcelJS from "exceljs";

export async function createWorkbook() {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "UniFlow Academic Planner";
  workbook.created = new Date();

  return workbook;
}

export function setupWorksheet(
  workbook: ExcelJS.Workbook,
  title: string
) {
  const sheet = workbook.addWorksheet(title, {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  return sheet;
}

export function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      size: 12,
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };
  });
}

export function applyDataStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

export function autoFitColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns?.forEach((column) => {
    let maxLength = 10;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const length = String(cell.value || "").length;
      if (length > maxLength) {
        maxLength = length;
      }
    });

    column.width = Math.min(maxLength + 2, 40);
  });
}

export async function exportWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
) {
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
import ExcelJS from "exceljs";

export type FacultyDetailRow = {
  initial: string;
  name: string;
  designation: string | null;
  departmentCode: string;
  phone: string | null;
  email: string | null;
};

export function styleTitleRow(row: ExcelJS.Row) {
  row.font = { bold: true, size: 14 };
}

export function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

export function styleAllBorders(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, colCount: number) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = 1; c <= colCount; c++) {
      ws.getRow(r).getCell(c).border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    }
  }
}

export function autoWidth(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });
}

export function addFacultyDetailsSection(
  ws: ExcelJS.Worksheet,
  startRow: number,
  facultyDetails: FacultyDetailRow[]
) {
  let rowNo = startRow;

  ws.getCell(`A${rowNo}`).value = "Faculty Details";
  ws.getRow(rowNo).font = { bold: true, size: 12 };
  rowNo += 1;

  ws.addRow([
    "Initial",
    "Name",
    "Designation",
    "Department",
    "Phone",
    "Email",
  ]);
  styleHeaderRow(ws.getRow(rowNo));
  const headerRowNo = rowNo;
  rowNo += 1;

  for (const faculty of facultyDetails) {
    ws.addRow([
      faculty.initial,
      faculty.name,
      faculty.designation ?? "-",
      faculty.departmentCode,
      faculty.phone ?? "-",
      faculty.email ?? "-",
    ]);
    rowNo += 1;
  }

  styleAllBorders(ws, headerRowNo, rowNo - 1, 6);
  autoWidth(ws, [12, 28, 24, 14, 18, 28]);
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
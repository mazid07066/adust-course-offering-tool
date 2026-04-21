import * as XLSX from "xlsx";
import {
  normalizeCourseCode,
  normalizeRoomCode,
  normalizeTeacherCode,
  normalizeText,
  parseBatchCodeFromHeader,
  parseCredit,
  parseTimeRange,
} from "@/lib/offering-template-normalize";

export type ParsedTemplateRow = {
  rowKey: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  batchHeaderText: string;
  batchCode: string;
  serialNo: string;
  courseTitle: string;
  courseCode: string;
  coofferedCourseCode: string;
  facultyInitial: string;
  section: string;
  credits: number;
  day: string;
  rawTime: string;
  startTime: string;
  endTime: string;
  timeParseOk: boolean;
  timeParseReason: string;
  tentativeEnrollment: string;
  room: string;
  courseType: string;
};

export type ParsedTemplateResult = {
  sheetName: string;
  rows: ParsedTemplateRow[];
  summary: {
    totalRows: number;
    totalBatchBlocks: number;
  };
};

function rowIsHeader(row: unknown[]) {
  const a = normalizeText(row[0]);
  const b = normalizeText(row[1]);
  const c = normalizeText(row[2]);

  return (
    a.toUpperCase().includes("SL. NO") &&
    b.toUpperCase().includes("COURSES TITLE") &&
    c.toUpperCase().includes("COURSES CODE")
  );
}

function rowLooksLikeData(row: unknown[]) {
  const courseTitle = normalizeText(row[1]);
  const courseCode = normalizeCourseCode(row[2]);
  return Boolean(courseTitle && courseCode);
}

export function parseOfferingTemplateWorkbook(fileBuffer: Buffer): ParsedTemplateResult {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const preferredSheetName =
    workbook.SheetNames.find((name) => normalizeText(name).toUpperCase() === "FINAL") ||
    workbook.SheetNames[0];

  if (!preferredSheetName) {
    throw new Error("No worksheet found in the uploaded file.");
  }

  const worksheet = workbook.Sheets[preferredSheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const rows: ParsedTemplateRow[] = [];
  let currentBatchHeaderText = "";
  let currentBatchCode = "";
  let insideBatchTable = false;
  let batchBlockCount = 0;

  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const colA = normalizeText(row[0]);

    if (colA.toUpperCase().startsWith("BATCH:")) {
      currentBatchHeaderText = colA;
      currentBatchCode = parseBatchCodeFromHeader(colA);
      insideBatchTable = false;
      batchBlockCount += 1;
      continue;
    }

    if (rowIsHeader(row)) {
      if (currentBatchCode) {
        insideBatchTable = true;
      }
      continue;
    }

    if (!insideBatchTable || !currentBatchCode) {
      continue;
    }

    if (!rowLooksLikeData(row)) {
      continue;
    }

    const timeInfo = parseTimeRange(row[8]);

    rows.push({
      rowKey: `${preferredSheetName}-${i + 1}-${currentBatchCode}-${normalizeCourseCode(row[2])}`,
      sourceSheetName: preferredSheetName,
      sourceRowNumber: i + 1,
      batchHeaderText: currentBatchHeaderText,
      batchCode: currentBatchCode,
      serialNo: normalizeText(row[0]),
      courseTitle: normalizeText(row[1]),
      courseCode: normalizeCourseCode(row[2]),
      coofferedCourseCode: normalizeCourseCode(row[3]),
      facultyInitial: normalizeTeacherCode(row[4]),
      section: normalizeText(row[5]),
      credits: parseCredit(row[6]),
      day: normalizeText(row[7]),
      rawTime: normalizeText(row[8]),
      startTime: timeInfo.startTime,
      endTime: timeInfo.endTime,
      timeParseOk: timeInfo.ok,
      timeParseReason: timeInfo.reason,
      tentativeEnrollment: "",
      room: normalizeRoomCode(row[9]),
      courseType: normalizeText(row[10]),
    });
  }

  return {
    sheetName: preferredSheetName,
    rows,
    summary: {
      totalRows: rows.length,
      totalBatchBlocks: batchBlockCount,
    },
  };
}
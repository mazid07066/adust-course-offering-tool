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

export type ParsedTemplateSlot = {
  day: string;
  rawTime: string;
  startTime: string;
  endTime: string;
  timeParseOk: boolean;
  timeParseReason: string;
};

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

  slot1: string;
  slot2: string;
  parsedSlots: ParsedTemplateSlot[];
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

function normalizeDay(value: unknown) {
  return normalizeText(value).toUpperCase();
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
      insideBatchTable = true;
      continue;
    }

    if (!insideBatchTable || !currentBatchCode) {
      continue;
    }

    if (!rowLooksLikeData(row)) {
      continue;
    }

    const serialNo = normalizeText(row[0]);
    const courseTitle = normalizeText(row[1]);
    const courseCode = normalizeCourseCode(row[2]);
    const coofferedCourseCode = normalizeCourseCode(row[3]);
    const facultyInitial = normalizeTeacherCode(row[4]);
    const section = normalizeText(row[5]);
    const credits = parseCredit(row[6]);

    const slot1 = normalizeDay(row[7]);
    const slot2 = normalizeDay(row[8]);

    const rawTime = normalizeText(row[9]).replace(/\s*\n\s*/g, " ");
    const parsedTime = parseTimeRange(rawTime);

    const room = normalizeRoomCode(row[10]);
    const courseType = normalizeText(row[11]);
    const tentativeEnrollment = "";

    const parsedSlots: ParsedTemplateSlot[] = [];
    const seenSlotKeys = new Set<string>();

    for (const day of [slot1, slot2].filter(Boolean)) {
      const slotKey = `${day}__${parsedTime.startTime || ""}__${parsedTime.endTime || ""}`;
      if (seenSlotKeys.has(slotKey)) continue;
      seenSlotKeys.add(slotKey);

      parsedSlots.push({
        day,
        rawTime,
        startTime: parsedTime.startTime,
        endTime: parsedTime.endTime,
        timeParseOk: parsedTime.ok,
        timeParseReason: parsedTime.reason,
      });
    }

    rows.push({
      rowKey: `${preferredSheetName}:${i + 1}:${currentBatchCode}:${courseCode}:${section}`,
      sourceSheetName: preferredSheetName,
      sourceRowNumber: i + 1,
      batchHeaderText: currentBatchHeaderText,
      batchCode: currentBatchCode,
      serialNo,
      courseTitle,
      courseCode,
      coofferedCourseCode,
      facultyInitial,
      section,
      credits,

      day: parsedSlots.map((slot) => slot.day).join(" / "),
      rawTime,
      startTime: parsedTime.startTime,
      endTime: parsedTime.endTime,
      timeParseOk: parsedTime.ok,
      timeParseReason: parsedTime.reason,

      tentativeEnrollment,
      room,
      courseType,

      slot1,
      slot2,
      parsedSlots,
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
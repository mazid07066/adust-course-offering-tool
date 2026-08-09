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

type ColumnMap = {
  serialNo: number;
  courseTitle: number;
  courseCode: number;

  coofferedCourseCode: number | null;
  facultyInitial: number | null;
  section: number | null;
  credits: number | null;

  day: number | null;
  slot1: number | null;
  slot2: number | null;

  time: number | null;
  tentativeEnrollment: number | null;
  room: number | null;
  courseType: number | null;
};

function normalizeHeader(value: unknown) {
  return normalizeText(value)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeDay(value: unknown) {
  return normalizeText(value)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getCell(
  row: unknown[],
  index: number | null
) {
  if (
    index === null ||
    index < 0 ||
    index >= row.length
  ) {
    return "";
  }

  return row[index];
}

function findHeaderIndex(
  headers: string[],
  candidates: string[]
) {
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];

    if (
      candidates.some(
        (candidate) =>
          header === candidate ||
          header.includes(candidate)
      )
    ) {
      return index;
    }
  }

  return null;
}

function rowIsHeader(row: unknown[]) {
  const headers = row.map(normalizeHeader);

  const serialIndex = findHeaderIndex(
    headers,
    [
      "SL. NO",
      "SL NO",
      "SERIAL",
    ]
  );

  const titleIndex = findHeaderIndex(
    headers,
    [
      "COURSES TITLE",
      "COURSE TITLE",
    ]
  );

  const codeIndex = findHeaderIndex(
    headers,
    [
      "COURSES CODE",
      "COURSE CODE",
    ]
  );

  return (
    serialIndex !== null &&
    titleIndex !== null &&
    codeIndex !== null
  );
}

function buildColumnMap(
  row: unknown[]
): ColumnMap {
  const headers = row.map(normalizeHeader);

  const serialNo =
    findHeaderIndex(
      headers,
      [
        "SL. NO",
        "SL NO",
        "SERIAL",
      ]
    ) ?? 0;

  const courseTitle =
    findHeaderIndex(
      headers,
      [
        "COURSES TITLE",
        "COURSE TITLE",
      ]
    ) ?? 1;

  const courseCode =
    findHeaderIndex(
      headers,
      [
        "COURSES CODE",
        "COURSE CODE",
      ]
    ) ?? 2;

  const coofferedCourseCode =
    findHeaderIndex(
      headers,
      [
        "CO-OFFERED COURSE CODE",
        "CO OFFERED COURSE CODE",
        "CO-OFFERED",
        "CO OFFERED",
      ]
    );

  const facultyInitial =
    findHeaderIndex(
      headers,
      [
        "FACULTY INITIAL",
        "FACULTY",
        "TEACHER INITIAL",
        "TEACHER",
      ]
    );

  const section =
    findHeaderIndex(
      headers,
      [
        "SECTION",
      ]
    );

  const credits =
    findHeaderIndex(
      headers,
      [
        "CREDITS",
        "CREDIT",
      ]
    );

  const tentativeEnrollment =
    findHeaderIndex(
      headers,
      [
        "TENTATIVE ENROLLMENT",
        "ENROLLMENT",
      ]
    );

  const room =
    findHeaderIndex(
      headers,
      [
        "ROOM",
      ]
    );

  const courseType =
    findHeaderIndex(
      headers,
      [
        "COURSE TYPE",
        "TYPE",
      ]
    );

  const time =
    findHeaderIndex(
      headers,
      [
        "TIME",
      ]
    );

  let day =
    findHeaderIndex(
      headers,
      [
        "DAY",
      ]
    );

  let slot1 =
    findHeaderIndex(
      headers,
      [
        "SLOT 1",
        "SLOT1",
        "DAY 1",
        "DAY1",
      ]
    );

  let slot2 =
    findHeaderIndex(
      headers,
      [
        "SLOT 2",
        "SLOT2",
        "DAY 2",
        "DAY2",
      ]
    );

  /*
   * Current ADUST offering sheet has a single
   * "Day" column. Treat it as Slot 1.
   */
  if (
    slot1 === null &&
    day !== null
  ) {
    slot1 = day;
  }

  /*
   * Do not duplicate the same column as both
   * generic day and another independent slot.
   */
  if (
    day === null &&
    slot1 !== null
  ) {
    day = slot1;
  }

  return {
    serialNo,
    courseTitle,
    courseCode,

    coofferedCourseCode,
    facultyInitial,
    section,
    credits,

    day,
    slot1,
    slot2,

    time,
    tentativeEnrollment,
    room,
    courseType,
  };
}

function rowLooksLikeData(
  row: unknown[],
  columns: ColumnMap
) {
  const courseTitle =
    normalizeText(
      getCell(
        row,
        columns.courseTitle
      )
    );

  const courseCode =
    normalizeCourseCode(
      getCell(
        row,
        columns.courseCode
      )
    );

  return Boolean(
    courseTitle &&
    courseCode
  );
}

export function parseOfferingTemplateWorkbook(
  fileBuffer: Buffer
): ParsedTemplateResult {
  const workbook = XLSX.read(
    fileBuffer,
    {
      type: "buffer",
    }
  );

  const preferredSheetName =
    workbook.SheetNames.find(
      (name) =>
        normalizeText(name)
          .trim()
          .toUpperCase() ===
        "FINAL"
    ) ||
    workbook.SheetNames[0];

  if (!preferredSheetName) {
    throw new Error(
      "No worksheet found in the uploaded file."
    );
  }

  const worksheet =
    workbook.Sheets[
      preferredSheetName
    ];

  const matrix =
    XLSX.utils.sheet_to_json<
      (
        | string
        | number
        | boolean
        | null
      )[]
    >(
      worksheet,
      {
        header: 1,
        defval: "",
        raw: false,
      }
    );

  const rows:
    ParsedTemplateRow[] = [];

  let currentBatchHeaderText = "";
  let currentBatchCode = "";
  let insideBatchTable = false;
  let batchBlockCount = 0;

  let columnMap:
    ColumnMap | null = null;

  for (
    let i = 0;
    i < matrix.length;
    i += 1
  ) {
    const row =
      matrix[i] || [];

    const colA =
      normalizeText(
        row[0]
      );

    if (
      colA
        .toUpperCase()
        .startsWith(
          "BATCH:"
        )
    ) {
      currentBatchHeaderText =
        colA;

      currentBatchCode =
        parseBatchCodeFromHeader(
          colA
        );

      insideBatchTable =
        false;

      columnMap =
        null;

      batchBlockCount +=
        1;

      continue;
    }

    if (
      rowIsHeader(row)
    ) {
      columnMap =
        buildColumnMap(
          row
        );

      insideBatchTable =
        true;

      continue;
    }

    if (
      !insideBatchTable ||
      !currentBatchCode ||
      !columnMap
    ) {
      continue;
    }

    if (
      !rowLooksLikeData(
        row,
        columnMap
      )
    ) {
      continue;
    }

    const serialNo =
      normalizeText(
        getCell(
          row,
          columnMap.serialNo
        )
      );

    const courseTitle =
      normalizeText(
        getCell(
          row,
          columnMap.courseTitle
        )
      );

    const courseCode =
      normalizeCourseCode(
        getCell(
          row,
          columnMap.courseCode
        )
      );

    const coofferedCourseCode =
      normalizeCourseCode(
        getCell(
          row,
          columnMap.coofferedCourseCode
        )
      );

    const facultyInitial =
      normalizeTeacherCode(
        getCell(
          row,
          columnMap.facultyInitial
        )
      );

    const section =
      normalizeText(
        getCell(
          row,
          columnMap.section
        )
      ) || "1";

    const credits =
      parseCredit(
        getCell(
          row,
          columnMap.credits
        )
      );

    const slot1 =
      normalizeDay(
        getCell(
          row,
          columnMap.slot1
        )
      );

    const slot2 =
      normalizeDay(
        getCell(
          row,
          columnMap.slot2
        )
      );

    const rawTime =
      normalizeText(
        getCell(
          row,
          columnMap.time
        )
      )
        .replace(
          /\s*\n\s*/g,
          " "
        )
        .trim();

    const parsedTime =
      parseTimeRange(
        rawTime
      );

    const tentativeEnrollment =
      normalizeText(
        getCell(
          row,
          columnMap.tentativeEnrollment
        )
      );

    const room =
      normalizeRoomCode(
        getCell(
          row,
          columnMap.room
        )
      );

    const courseType =
      normalizeText(
        getCell(
          row,
          columnMap.courseType
        )
      );

    const parsedSlots:
      ParsedTemplateSlot[] =
      [];

    const seenSlotKeys =
      new Set<string>();

    const days =
      [slot1, slot2]
        .map(
          (value) =>
            normalizeDay(value)
        )
        .filter(Boolean);

    for (
      const day of days
    ) {
      const slotKey =
        `${day}__${parsedTime.startTime || ""}__${parsedTime.endTime || ""}`;

      if (
        seenSlotKeys.has(
          slotKey
        )
      ) {
        continue;
      }

      seenSlotKeys.add(
        slotKey
      );

      parsedSlots.push({
        day,
        rawTime,

        startTime:
          parsedTime.startTime,

        endTime:
          parsedTime.endTime,

        timeParseOk:
          parsedTime.ok,

        timeParseReason:
          parsedTime.reason,
      });
    }

    rows.push({
      rowKey:
        `${preferredSheetName}:${i + 1}:${currentBatchCode}:${courseCode}:${section}`,

      sourceSheetName:
        preferredSheetName,

      sourceRowNumber:
        i + 1,

      batchHeaderText:
        currentBatchHeaderText,

      batchCode:
        currentBatchCode,

      serialNo,
      courseTitle,
      courseCode,
      coofferedCourseCode,
      facultyInitial,
      section,
      credits,

      day:
        parsedSlots
          .map(
            (slot) =>
              slot.day
          )
          .join(" / "),

      rawTime,

      startTime:
        parsedTime.startTime,

      endTime:
        parsedTime.endTime,

      timeParseOk:
        parsedTime.ok,

      timeParseReason:
        parsedTime.reason,

      tentativeEnrollment,
      room,
      courseType,

      slot1,
      slot2,
      parsedSlots,
    });
  }

  return {
    sheetName:
      preferredSheetName,

    rows,

    summary: {
      totalRows:
        rows.length,

      totalBatchBlocks:
        batchBlockCount,
    },
  };
}
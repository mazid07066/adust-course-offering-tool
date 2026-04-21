export function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

/**
 * Canonical course-code normalization for matching only.
 */
export function normalizeCourseCode(value: unknown) {
  const raw = normalizeUpper(value);
  if (!raw) return "";

  return raw
    .replace(/\./g, "")
    .replace(/[–—-]/g, "-")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([A-Z]{2,5})\s+(\d{3,4})\b/g, "$1$2");
}

export function normalizeCourseTitle(value: unknown) {
  return normalizeUpper(value)
    .replace(/[–—-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeRoomCode(value: unknown) {
  return normalizeUpper(value)
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTeacherCode(value: unknown) {
  return normalizeUpper(value).replace(/\s+/g, "");
}

export function normalizeCourseType(value: unknown) {
  return normalizeUpper(value)
    .replace(/[–—-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSlotOptionalCourseType(courseType: unknown, courseTitle?: unknown) {
  const type = normalizeCourseType(courseType);
  const title = normalizeUpper(courseTitle);

  if (
    type.includes("PROJECT") ||
    type.includes("INTERNSHIP") ||
    type.includes("THESIS") ||
    type.includes("INDUSTRIAL TRAINING") ||
    type.includes("FIELD WORK") ||
    type.includes("VIVA")
  ) {
    return true;
  }

  if (
    title.includes("FINAL YEAR DESIGN PROJECT") ||
    title.includes("FYDP") ||
    title.includes("INTERNSHIP") ||
    title.includes("THESIS") ||
    title.includes("INDUSTRIAL TRAINING") ||
    title.includes("VIVA")
  ) {
    return true;
  }

  return false;
}

export function parseBatchCodeFromHeader(headerText: string) {
  const normalized = normalizeText(headerText);
  const match = normalized.match(/BATCH\s*:\s*(\d{2,4})/i);
  return match ? match[1] : "";
}

function to24Hour(hour12: number, minute: number, meridiem: "AM" | "PM") {
  let hour24 = hour12 % 12;
  if (meridiem === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseOneTimeWithOptionalMeridiem(
  value: string,
  fallbackMeridiem?: "AM" | "PM"
) {
  const cleaned = normalizeUpper(value).replace(/\./g, "");
  const match = cleaned.match(/^(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)?$/);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = (match[3] as "AM" | "PM" | undefined) || fallbackMeridiem;

  if (!meridiem) return null;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  return to24Hour(hour, minute, meridiem);
}

export function parseOneCourseCodeAliases(value: unknown) {
  const text = normalizeUpper(value);
  if (!text) return [];

  const matches = text.match(/[A-Z]{2,5}\s*\d{3,4}/g) || [];

  return Array.from(
    new Set(
      matches.map((item) =>
        item
          .toUpperCase()
          .replace(/\./g, "")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/\b([A-Z]{2,5})\s+(\d{3,4})\b/g, "$1$2")
      )
    )
  );
}

export function parseTimeRange(value: unknown) {
  const raw = String(value ?? "")
    .replace(/\n/g, " ")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) {
    return {
      ok: false,
      startTime: "",
      endTime: "",
      reason: "Time is empty.",
    };
  }

  const parts = raw.split(/\s*-\s*/);

  if (parts.length !== 2) {
    return {
      ok: false,
      startTime: "",
      endTime: "",
      reason: `Invalid time range: ${raw}`,
    };
  }

  const rightMeridiemMatch = normalizeUpper(parts[1]).match(/\b(AM|PM)\b/);
  const fallbackMeridiem = rightMeridiemMatch
    ? (rightMeridiemMatch[1] as "AM" | "PM")
    : undefined;

  const startTime = parseOneTimeWithOptionalMeridiem(parts[0], fallbackMeridiem);
  const endTime = parseOneTimeWithOptionalMeridiem(parts[1]);

  if (!startTime || !endTime) {
    return {
      ok: false,
      startTime: "",
      endTime: "",
      reason: `Could not parse time range: ${raw}`,
    };
  }

  return {
    ok: true,
    startTime,
    endTime,
    reason: "",
  };
}

export function parseCredit(value: unknown) {
  const text = normalizeText(value).replace(/[^\d.]/g, "");
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function isBlankLikeFaculty(value: unknown) {
  const text = normalizeUpper(value);
  return !text || text === "-" || text === "N/A" || text === "NA";
}

/**
 * Build room lookup candidates from template room cell.
 *
 * Priority:
 * 1. Numeric room number if present
 * 2. Full normalized text
 *
 * Examples:
 * - "408" -> ["408"]
 * - "SCPIL (104)" -> ["104", "SCPIL (104)"]
 * - "PECL (110)" -> ["110", "PECL (110)"]
 * - "LAB 103" -> ["103", "LAB 103"]
 * - "CORE" -> ["CORE"]
 */
export function buildRoomLookupCandidates(value: unknown) {
  const normalized = normalizeRoomCode(value);
  if (!normalized) return [];

  const out: string[] = [];

  const parenMatch = normalized.match(/\((\d{2,4})\)/);
  if (parenMatch?.[1]) {
    out.push(parenMatch[1]);
  }

  const directNumberMatch = normalized.match(/\b(\d{2,4})\b/);
  if (directNumberMatch?.[1] && !out.includes(directNumberMatch[1])) {
    out.push(directNumberMatch[1]);
  }

  if (!out.includes(normalized)) {
    out.push(normalized);
  }

  return Array.from(new Set(out));
}
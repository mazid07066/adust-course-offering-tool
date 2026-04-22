import pdfParse from "pdf-parse";

export type ParsedTranscriptCourse = {
  semester: string;
  code: string;
  comparableCode: string;
  comparableTitle: string;
  title: string;
  credits: number;
  grade: string;
};

export type ParsedRegistrationCourse = {
  code: string;
  comparableCode: string;
  comparableTitle: string;
  title: string;
  credits: number;
  section: string | null;
};

export type ParsedStudentIdentity = {
  studentId: string | null;
  batchCode: string | null;
  suffix: string | null;
};

function normalizeInline(value: string) {
  return String(value || "")
    .replace(/[ï¿¾ï¿½]/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

function normalizeMultiline(value: string) {
  return String(value || "")
    .replace(/[ï¿¾ï¿½]/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeInline(line))
    .filter(Boolean)
    .join("\n");
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function collapseText(value: string) {
  return normalizeMultiline(value).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeRawCourseCode(value: string) {
  const raw = normalizeInline(value).toUpperCase();
  if (!raw) return "";

  const compact = raw.replace(/\s+/g, "");

  const directMatch = compact.match(/^([A-Z]{2,6})(\d{3,4})$/);
  if (directMatch) return `${directMatch[1]}${directMatch[2]}`;

  const spacedTailMatch = raw.match(/^([A-Z]{2,6})(?:\s+\d{2,4})?\s+(\d{3,4})$/);
  if (spacedTailMatch) return `${spacedTailMatch[1]}${spacedTailMatch[2]}`;

  const genericMatch = compact.match(/^([A-Z]{2,6}).*?(\d{3,4})$/);
  if (genericMatch) return `${genericMatch[1]}${genericMatch[2]}`;

  return compact;
}

function normalizeDepartmentSpecificAlias(prefix: string, digits: string) {
  const threeDigitAliasPrefixes = new Set([
    "EEE",
    "MAT",
    "PHY",
    "CHE",
    "MEE",
    "CSE",
    "ENG",
    "STA",
    "HUM",
    "ACT",
    "ECO",
    "SOC",
    "ENV",
    "HIS",
    "BBA",
    "MGT",
    "PEV",
    "PHI",
    "CSC",
  ]);

  if (digits.length === 4 && digits.startsWith("1") && threeDigitAliasPrefixes.has(prefix)) {
    return `${prefix}${digits.slice(1)}`;
  }

  return `${prefix}${digits}`;
}

export function normalizeComparableCourseCode(value: string) {
  const normalized = normalizeRawCourseCode(value);
  if (!normalized) return "";

  const match = normalized.match(/^([A-Z]{2,6})(\d{3,4})$/);
  if (!match) return normalized;

  const prefix = match[1];
  const digits = match[2];

  return normalizeDepartmentSpecificAlias(prefix, digits);
}

function cleanRegistrationTitle(value: string) {
  let cleaned = normalizeInline(value);

  cleaned = cleaned.replace(
    /\s+(?:SU|SA|TH|MO|FR|WE)-\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?.*$/i,
    ""
  );

  cleaned = cleaned.replace(/\s+[A-Z]{2,6}\d{2,}.*$/i, (match) => {
    return /\b(?:MU|WE|EE|CE|ME|LAB|ROOM)\b/i.test(match) ? "" : match;
  });

  return normalizeInline(cleaned);
}

export function normalizeComparableTitle(value: string) {
  return cleanRegistrationTitle(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|course|lab\s*course)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const parsed = await pdfParse(buffer, { version: "v1.10.100" });
    return normalizeMultiline(parsed?.text || "");
  } catch {
    const PDFParserModule = await import("pdf2json");
    const PDFParser = PDFParserModule.default;

    const text = await new Promise<string>((resolve, reject) => {
      const parser = new PDFParser(undefined, true);

      parser.on("pdfParser_dataError", (errMsg: Error | { parserError: Error }) => {
        const actualError = errMsg instanceof Error ? errMsg : errMsg.parserError;
        reject(actualError);
      });

      parser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          const pages = pdfData?.Pages || [];
          const pageLines: string[] = [];

          for (const page of pages) {
            const lines: string[] = [];

            for (const textItem of page.Texts || []) {
              const line = (textItem.R || [])
                .map((run: { T?: string }) => safeDecodeURIComponent(run.T || ""))
                .join(" ");

              const cleaned = normalizeInline(line);
              if (cleaned) lines.push(cleaned);
            }

            pageLines.push(lines.join("\n"));
          }

          resolve(normalizeMultiline(pageLines.join("\n")));
        } catch (error) {
          reject(error);
        }
      });

      parser.parseBuffer(buffer);
    });

    return normalizeMultiline(text);
  }
}

export function parseStudentIdentity(text: string): ParsedStudentIdentity {
  const match = text.match(/\b(\d{2,3}-\d{4}-\d{3})\b/);

  if (!match) {
    return {
      studentId: null,
      batchCode: null,
      suffix: null,
    };
  }

  const studentId = match[1];
  const [batchCode, , suffix] = studentId.split("-");

  return {
    studentId,
    batchCode: batchCode || null,
    suffix: suffix || null,
  };
}

function stripTranscriptFooter(segment: string) {
  let cleaned = segment;

  const footerPatterns = [
    /\bCredits\s*Earned\b[\s\S]*$/i,
    /\bTransfered\s*Credits\b[\s\S]*$/i,
    /\bGPA\s*:\s*[\s\S]*$/i,
    /\bPrinted\s*(?:on)?\s*:\s*[\s\S]*$/i,
    /\bPage\s+\d+\s+of\s+\d+\b[\s\S]*$/i,
  ];

  for (const pattern of footerPatterns) {
    cleaned = cleaned.replace(pattern, "").trim();
  }

  return cleaned;
}

function splitTranscriptIntoSegments(text: string) {
  let clean = collapseText(text);

  clean = clean
    .replace(/SemesterCodeDescriptionCreditsGrade/gi, " ")
    .replace(/CreditsEarned/gi, " Credits Earned ")
    .replace(/TransferedCredits/gi, " Transfered Credits ")
    .replace(/Printedon:/gi, " Printed on: ")
    .replace(/StudentID:/gi, " Student ID: ");

  clean = clean.replace(
    /(?=(SPRING|SUMMER|FALL)\s*\d{4}\s*[A-Z]{2,6}\d{3,4})/gi,
    " ||ROW|| "
  );

  return clean
    .split("||ROW||")
    .map((part) => stripTranscriptFooter(normalizeInline(part)))
    .filter(Boolean);
}

function sanitizeTranscriptForParsing(text: string) {
  let clean = collapseText(text);

  clean = clean
    .replace(/Semester\s*Code\s*Description\s*Credits\s*Grade/gi, " ")
    .replace(/SemesterCodeDescriptionCreditsGrade/gi, " ")
    .replace(/CreditsEarned/gi, " Credits Earned ")
    .replace(/TransferedCredits/gi, " Transfered Credits ")
    .replace(/Printedon:/gi, " Printed on: ")
    .replace(/StudentID:/gi, " Student ID: ")
    .replace(/\*\*\s*Printed\s*:.*?(?=(SPRING|SUMMER|FALL)\s*\d{4}\s*[A-Z]{2,6}\d{3,4}|Credits\s*Earned|$)/gi, " ")
    .replace(/\bPage\s+\d+\s+of\s+\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean;
}

function dedupeTranscriptRows(rows: ParsedTranscriptCourse[]) {
  const seen = new Set<string>();
  const output: ParsedTranscriptCourse[] = [];

  for (const row of rows) {
    const key = [
      row.semester,
      row.code,
      row.title.toLowerCase(),
      row.credits.toFixed(2),
      row.grade,
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }

  return output;
}

function parseTranscriptCoursesGlobal(text: string): ParsedTranscriptCourse[] {
  const clean = sanitizeTranscriptForParsing(text);
  const rows: ParsedTranscriptCourse[] = [];

  const fullRegex =
    /(SPRING|SUMMER|FALL)\s*(\d{4})\s*([A-Z]{2,6}\d{3,4})\s+([\s\S]*?)\s+(\d+(?:\.\d+)?)\s+([A-F][+-]?|I|W)(?=\s+(?:SPRING|SUMMER|FALL)\s*\d{4}\s*[A-Z]{2,6}\d{3,4}|\s+Credits\s*Earned\b|\s+Transfered\s*Credits\b|\s+GPA\s*:|\s+\*\*\s*Printed|\s+Page\s+\d+\s+of\s+\d+|$)/gi;

  for (const match of clean.matchAll(fullRegex)) {
    const semester = `${String(match[1]).toUpperCase()} ${match[2]}`;
    const code = normalizeInline(match[3]).toUpperCase();
    const title = normalizeInline(match[4]);
    const credits = Number(match[5]);
    const grade = normalizeInline(match[6]).toUpperCase();

    if (!code || !title || Number.isNaN(credits) || !grade) continue;

    rows.push({
      semester,
      code,
      comparableCode: normalizeComparableCourseCode(code),
      comparableTitle: normalizeComparableTitle(title),
      title,
      credits,
      grade,
    });
  }

  if (rows.length > 0) {
    return dedupeTranscriptRows(rows);
  }

  return [];
}

export function parseTranscriptCourses(text: string): ParsedTranscriptCourse[] {
  const globalRows = parseTranscriptCoursesGlobal(text);
  if (globalRows.length > 0) {
    return globalRows;
  }

  const segments = splitTranscriptIntoSegments(text);
  const rows: ParsedTranscriptCourse[] = [];

  for (const segment of segments) {
    if (!/^(SPRING|SUMMER|FALL)\s*\d{4}\s*[A-Z]{2,6}\d{3,4}/i.test(segment)) {
      continue;
    }

    const fullMatch = segment.match(
      /^(SPRING|SUMMER|FALL)\s*(\d{4})\s*([A-Z]{2,6}\d{3,4})\s*(.*?)\s*(\d+(?:\.\d+)?)\s*([A-F][+-]?|I|W)$/i
    );

    if (fullMatch) {
      const semester = `${String(fullMatch[1]).toUpperCase()} ${fullMatch[2]}`;
      const code = normalizeInline(fullMatch[3]).toUpperCase();
      const title = normalizeInline(fullMatch[4]);
      const credits = Number(fullMatch[5]);
      const grade = normalizeInline(fullMatch[6]).toUpperCase();

      if (code && title && !Number.isNaN(credits) && grade) {
        rows.push({
          semester,
          code,
          comparableCode: normalizeComparableCourseCode(code),
          comparableTitle: normalizeComparableTitle(title),
          title,
          credits,
          grade,
        });
      }
      continue;
    }

    const noGradeMatch = segment.match(
      /^(SPRING|SUMMER|FALL)\s*(\d{4})\s*([A-Z]{2,6}\d{3,4})\s*(.*?)\s*(\d+(?:\.\d+)?)$/i
    );

    if (noGradeMatch) {
      const semester = `${String(noGradeMatch[1]).toUpperCase()} ${noGradeMatch[2]}`;
      const code = normalizeInline(noGradeMatch[3]).toUpperCase();
      const title = normalizeInline(noGradeMatch[4]);
      const credits = Number(noGradeMatch[5]);

      if (code && title && !Number.isNaN(credits)) {
        rows.push({
          semester,
          code,
          comparableCode: normalizeComparableCourseCode(code),
          comparableTitle: normalizeComparableTitle(title),
          title,
          credits,
          grade: "",
        });
      }
    }
  }

  return dedupeTranscriptRows(rows);
}

export function parseTranscriptEarnedCredits(text: string): number | null {
  const clean = sanitizeTranscriptForParsing(text);

  const match = clean.match(/Credits\s*Earned\s*:\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

export function parseRegistrationSemester(text: string): string | null {
  const match = text.match(/Registration\s+(Spring|Summer|Fall),?\s+(\d{4})/i);
  if (!match) return null;
  return `${match[1].toUpperCase()} ${match[2]}`;
}

export function parseRegistrationCourses(text: string): ParsedRegistrationCourse[] {
  const clean = collapseText(text);

  const segments =
    clean.match(
      /A-[A-Z]{2,6}\d{3,4}CR:\d+(?:\.\d+)?Sec:\d+\s+.*?(?=A-[A-Z]{2,6}\d{3,4}CR:|Developed by:|Office Copy|Bank Copy|University Management Information System|$)/gi
    ) || [];

  const rows: ParsedRegistrationCourse[] = [];

  for (const segment of segments) {
    const match = normalizeInline(segment).match(
      /^A-([A-Z]{2,6}\d{3,4})CR:(\d+(?:\.\d+)?)Sec:(\d+)\s+(.+?)(?=\s+(?:SU|SA|TH|MO|FR|WE)-|$)/i
    );

    if (!match) continue;

    const code = normalizeInline(match[1]).toUpperCase();
    const title = cleanRegistrationTitle(match[4]);

    rows.push({
      code,
      comparableCode: normalizeComparableCourseCode(code),
      comparableTitle: normalizeComparableTitle(title),
      credits: Number(match[2]),
      section: normalizeInline(match[3]) || null,
      title,
    });
  }

  return rows;
}

const TERM_ORDER = ["SPRING", "SUMMER", "FALL"];

export function compareTerms(a: string, b: string) {
  const [aTerm, aYearText] = a.split(" ");
  const [bTerm, bYearText] = b.split(" ");

  const aYear = Number(aYearText);
  const bYear = Number(bYearText);

  if (aYear !== bYear) return aYear - bYear;
  return TERM_ORDER.indexOf(aTerm) - TERM_ORDER.indexOf(bTerm);
}

export function getLatestTerm(terms: string[]): string | null {
  if (!terms.length) return null;
  return [...terms].sort(compareTerms).at(-1) || null;
}

export function getNextTerm(term: string | null): string | null {
  if (!term) return null;

  const [season, yearText] = term.split(" ");
  const year = Number(yearText);

  if (season === "SPRING") return `SUMMER ${year}`;
  if (season === "SUMMER") return `FALL ${year}`;
  if (season === "FALL") return `SPRING ${year + 1}`;

  return null;
}

export function getCompletedCourseMap(courses: ParsedTranscriptCourse[]) {
  const map = new Map<
    string,
    {
      code: string;
      comparableCode: string;
      comparableTitle: string;
      title: string;
      semester: string;
      credits: number;
      grade: string;
    }
  >();

  for (const row of courses) {
    const isPassing =
      row.grade !== "F" &&
      row.grade !== "I" &&
      row.grade !== "W" &&
      row.credits > 0;

    if (!isPassing) continue;

    const existing = map.get(row.comparableCode);
    if (!existing || compareTerms(existing.semester, row.semester) < 0) {
      map.set(row.comparableCode, {
        code: row.code,
        comparableCode: row.comparableCode,
        comparableTitle: row.comparableTitle,
        title: row.title,
        semester: row.semester,
        credits: row.credits,
        grade: row.grade,
      });
    }
  }

  return map;
}

export function getFailedOnlyCodes(courses: ParsedTranscriptCourse[]) {
  const passed = new Set(
    courses
      .filter(
        (row) =>
          row.grade !== "F" &&
          row.grade !== "I" &&
          row.grade !== "W" &&
          row.credits > 0
      )
      .map((row) => row.comparableCode)
  );

  const failed = new Set(
    courses
      .filter(
        (row) =>
          row.grade === "F" ||
          row.grade === "I" ||
          row.grade === "W" ||
          row.credits <= 0
      )
      .map((row) => row.comparableCode)
  );

  return [...failed].filter((code) => !passed.has(code));
}

export function sumCourseCredits(items: Array<{ credits: number }>) {
  const total = items.reduce((sum, item) => {
    const numeric = Number(item.credits || 0);
    return sum + (Number.isNaN(numeric) ? 0 : numeric);
  }, 0);

  return Number(total.toFixed(2));
}

export function makeDebugTextSample(text: string, maxLength = 1500) {
  return collapseText(text).slice(0, maxLength);
}
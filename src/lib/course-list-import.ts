import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { CourseType } from "@prisma/client";

export type ParsedMasterCourse = {
  code: string;
  title: string;
  creditHours: number;
  theoryCredits: number;
  labCredits: number;
  semesterNo: number | null;
  courseType: CourseType;
  isElective: boolean;
  electiveGroup: string | null;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCourseCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);

  // Example:
  // RAE 0714 1101 -> RAE1101
  // ENG 0231 1206 -> ENG1206
  // PHY1113 -> PHY1113
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (/^[A-Z]{2,8}$/.test(first) && /^\d{4}$/.test(last)) {
      return `${first}${last}`;
    }
  }

  const joined = cleaned.replace(/\s+/g, "");
  const match = joined.match(/^([A-Z]{2,8})(\d{4})$/);
  if (match) {
    return `${match[1]}${match[2]}`;
  }

  return joined;
}

function isCourseCode(raw: string): boolean {
  const code = normalizeCourseCode(raw);
  return /^[A-Z]{2,8}\d{4}$/.test(code);
}

function parseCredit(raw: string): number | null {
  const cleaned = normalizeWhitespace(raw);
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

function detectCourseType(title: string): CourseType {
  const upper = title.toUpperCase();
  if (upper.includes("LAB")) return CourseType.LAB;
  if (upper.includes("PROJECT") || upper.includes("DISSERTATION")) return CourseType.PROJECT;
  if (upper.includes("INTERNSHIP")) return CourseType.INTERNSHIP;
  return CourseType.THEORY;
}

function splitTheoryLabCredits(courseType: CourseType, creditHours: number) {
  if (courseType === CourseType.LAB || courseType === CourseType.INTERNSHIP) {
    return { theoryCredits: 0, labCredits: creditHours };
  }
  return { theoryCredits: creditHours, labCredits: 0 };
}

function parseSemesterNumberFromCode(code: string): number | null {
  const match = code.match(/^[A-Z]{2,8}(\d{4})$/);
  if (!match) return null;
  const semesterDigit = Number(match[1][0]);
  return Number.isNaN(semesterDigit) ? null : semesterDigit;
}

function deduplicateCourses(courses: ParsedMasterCourse[]): ParsedMasterCourse[] {
  const map = new Map<string, ParsedMasterCourse>();
  for (const course of courses) {
    map.set(course.code, course);
  }
  return Array.from(map.values());
}

function buildCourse(codeRaw: string, titleRaw: string, creditRaw: string | number, electiveGroup: string | null): ParsedMasterCourse | null {
  const code = normalizeCourseCode(codeRaw);
  const title = normalizeWhitespace(String(titleRaw));
  const creditHours = parseCredit(String(creditRaw));

  if (!isCourseCode(codeRaw) || !title || creditHours === null) {
    return null;
  }

  const courseType = detectCourseType(title);
  const credits = splitTheoryLabCredits(courseType, creditHours);

  return {
    code,
    title,
    creditHours,
    theoryCredits: credits.theoryCredits,
    labCredits: credits.labCredits,
    semesterNo: parseSemesterNumberFromCode(code),
    courseType,
    isElective: electiveGroup !== null,
    electiveGroup,
  };
}

function parseDocxLinesToCourses(lines: string[]): ParsedMasterCourse[] {
  const courses: ParsedMasterCourse[] = [];
  let electiveGroup: string | null = null;

  const cleanedLines = lines
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i];

    const groupMatch = line.match(/^Group\s*-\s*([A-Z0-9]+)/i);
    if (groupMatch) {
      electiveGroup = groupMatch[1].toUpperCase();
      continue;
    }

    if (
      /^Course Code$/i.test(line) ||
      /^Course Title$/i.test(line) ||
      /^Credits?$/i.test(line) ||
      /^Credit Hours?$/i.test(line) ||
      /^Credit Hour$/i.test(line)
    ) {
      continue;
    }

    if (!isCourseCode(line)) continue;

    let title = "";
    let credit: string | number = "";

    // Common case in docx:
    // code
    // title
    // credit
    if (cleanedLines[i + 1] && !isCourseCode(cleanedLines[i + 1])) {
      title = cleanedLines[i + 1];
    }
    if (cleanedLines[i + 2]) {
      credit = cleanedLines[i + 2];
    }

    const built = buildCourse(line, title, credit, electiveGroup);
    if (built) {
      courses.push(built);
      i += 2;
      continue;
    }

    // Fallback case:
    // code title credit all in nearby lines or odd formatting
    const fallbackTitle = cleanedLines[i + 1] ?? "";
    const fallbackCredit = cleanedLines[i + 3] ?? cleanedLines[i + 2] ?? "";
    const builtFallback = buildCourse(line, fallbackTitle, fallbackCredit, electiveGroup);
    if (builtFallback) {
      courses.push(builtFallback);
    }
  }

  return deduplicateCourses(courses);
}

export async function parseDocxCourseList(buffer: Buffer): Promise<ParsedMasterCourse[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value || "";
  const lines = text.split(/\r?\n/);
  return parseDocxLinesToCourses(lines);
}

function parseXlsxRowsToCourses(rows: string[][]): ParsedMasterCourse[] {
  const courses: ParsedMasterCourse[] = [];
  let electiveGroup: string | null = null;

  for (const row of rows) {
    const cells = row
      .map((cell) => normalizeWhitespace(String(cell ?? "")))
      .filter(Boolean);

    if (cells.length === 0) continue;

    const joined = cells.join(" ").trim();

    const groupMatch = joined.match(/^Group\s*-\s*([A-Z0-9]+)/i);
    if (groupMatch) {
      electiveGroup = groupMatch[1].toUpperCase();
      continue;
    }

    // Skip common headers
    if (
      joined.match(/^Sl$/i) ||
      joined.match(/^Course Code$/i) ||
      joined.match(/^Course Title$/i) ||
      joined.match(/^Credits?$/i) ||
      joined.match(/^Credit Hours?$/i) ||
      joined.match(/^Credit Hour$/i) ||
      joined.match(/^Course Designation$/i)
    ) {
      continue;
    }

    // Try to find code cell and credit cell anywhere in row
    let codeIndex = -1;
    let creditIndex = -1;

    for (let i = 0; i < cells.length; i++) {
      if (codeIndex === -1 && isCourseCode(cells[i])) {
        codeIndex = i;
      }
    }

    for (let i = cells.length - 1; i >= 0; i--) {
      if (parseCredit(cells[i]) !== null) {
        creditIndex = i;
        break;
      }
    }

    if (codeIndex === -1 || creditIndex === -1 || creditIndex <= codeIndex) {
      continue;
    }

    const codeRaw = cells[codeIndex];
    const creditRaw = cells[creditIndex];
    const titleRaw = cells.slice(codeIndex + 1, creditIndex).join(" ").trim();

    const built = buildCourse(codeRaw, titleRaw, creditRaw, electiveGroup);
    if (built) {
      courses.push(built);
    }
  }

  return deduplicateCourses(courses);
}

export async function parseXlsxCourseList(buffer: Buffer): Promise<ParsedMasterCourse[]> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const allCourses: ParsedMasterCourse[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    const normalizedRows = rows.map((row) => row.map((cell) => String(cell ?? "")));
    const courses = parseXlsxRowsToCourses(normalizedRows);
    allCourses.push(...courses);
  }

  return deduplicateCourses(allCourses);
}

export async function parseMasterCourseListFile(
  buffer: Buffer,
  fileName: string
): Promise<ParsedMasterCourse[]> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".docx")) {
    return parseDocxCourseList(buffer);
  }

  if (lower.endsWith(".xlsx")) {
    return parseXlsxCourseList(buffer);
  }

  throw new Error("Only .docx and .xlsx master course list files are supported.");
}
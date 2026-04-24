import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type CourseType = "THEORY" | "LAB" | "PROJECT" | "INTERNSHIP";

export type ParsedMasterCourse = {
  code: string;
  title: string;
  creditHours: number;
  theoryCredits: number;
  labCredits: number;
  semesterNo: number | null;
  levelTerm: string | null;
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

  if (upper.includes("LAB")) return "LAB";
  if (upper.includes("PROJECT") || upper.includes("DISSERTATION")) return "PROJECT";
  if (upper.includes("INTERNSHIP")) return "INTERNSHIP";

  return "THEORY";
}

function splitTheoryLabCredits(courseType: CourseType, creditHours: number) {
  if (courseType === "LAB" || courseType === "INTERNSHIP") {
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

function parseLevelTermFromCode(code: string): string | null {
  const match = code.match(/^[A-Z]{2,8}(\d{4})$/);
  if (!match) return null;

  const digits = match[1];
  const level = Number(digits[0]);
  const term = Number(digits[1]);

  if (!Number.isFinite(level) || !Number.isFinite(term)) return null;
  if (level <= 0 || term <= 0) return null;

  return `${level}.${term}`;
}

function parseExplicitLevelTerm(raw: string): string | null {
  const cleaned = normalizeWhitespace(raw).toUpperCase();

  if (!cleaned) return null;

  let match = cleaned.match(/^(\d+)[.\-_/ ](\d+)$/);
  if (match) return `${Number(match[1])}.${Number(match[2])}`;

  match = cleaned.match(/^L?\s*(\d+)\s*T?\s*(\d+)$/i);
  if (match) return `${Number(match[1])}.${Number(match[2])}`;

  match = cleaned.match(/LEVEL\s*(\d+)\s*TERM\s*(\d+)/i);
  if (match) return `${Number(match[1])}.${Number(match[2])}`;

  match = cleaned.match(/YEAR\s*(\d+)\s*SEM(?:ESTER)?\s*(\d+)/i);
  if (match) return `${Number(match[1])}.${Number(match[2])}`;

  return null;
}

function deduplicateCourses(courses: ParsedMasterCourse[]): ParsedMasterCourse[] {
  const map = new Map<string, ParsedMasterCourse>();

  for (const course of courses) {
    const existing = map.get(course.code);

    if (!existing) {
      map.set(course.code, course);
      continue;
    }

    const existingLevel = existing.levelTerm ? 1 : 0;
    const currentLevel = course.levelTerm ? 1 : 0;

    if (currentLevel > existingLevel) {
      map.set(course.code, course);
    }
  }

  return Array.from(map.values());
}

function buildCourse(
  codeRaw: string,
  titleRaw: string,
  creditRaw: string | number,
  electiveGroup: string | null,
  explicitLevelTerm?: string | null
): ParsedMasterCourse | null {
  const code = normalizeCourseCode(codeRaw);
  const title = normalizeWhitespace(String(titleRaw));
  const creditHours = parseCredit(String(creditRaw));

  if (!isCourseCode(codeRaw) || !title || creditHours === null) {
    return null;
  }

  const courseType = detectCourseType(title);
  const credits = splitTheoryLabCredits(courseType, creditHours);
  const inferredLevelTerm = parseLevelTermFromCode(code);
  const resolvedLevelTerm =
    parseExplicitLevelTerm(explicitLevelTerm || "") || inferredLevelTerm;

  return {
    code,
    title,
    creditHours,
    theoryCredits: credits.theoryCredits,
    labCredits: credits.labCredits,
    semesterNo: parseSemesterNumberFromCode(code),
    levelTerm: resolvedLevelTerm,
    courseType,
    isElective: electiveGroup !== null,
    electiveGroup,
  };
}

function parseDocxLinesToCourses(lines: string[]): ParsedMasterCourse[] {
  const courses: ParsedMasterCourse[] = [];
  let electiveGroup: string | null = null;
  let currentLevelTerm: string | null = null;

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

    const explicitLevelTerm = parseExplicitLevelTerm(line);
    if (explicitLevelTerm) {
      currentLevelTerm = explicitLevelTerm;
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

    if (cleanedLines[i + 1] && !isCourseCode(cleanedLines[i + 1])) {
      title = cleanedLines[i + 1];
    }

    if (cleanedLines[i + 2]) {
      credit = cleanedLines[i + 2];
    }

    const built = buildCourse(line, title, credit, electiveGroup, currentLevelTerm);
    if (built) {
      courses.push(built);
      i += 2;
      continue;
    }

    const fallbackTitle = cleanedLines[i + 1] ?? "";
    const fallbackCredit = cleanedLines[i + 3] ?? cleanedLines[i + 2] ?? "";

    const builtFallback = buildCourse(
      line,
      fallbackTitle,
      fallbackCredit,
      electiveGroup,
      currentLevelTerm
    );

    if (builtFallback) {
      courses.push(builtFallback);
    }
  }

  return deduplicateCourses(courses);
}

export async function parseDocxCourseList(
  buffer: Buffer
): Promise<ParsedMasterCourse[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value || "";
  const lines = text.split(/\r?\n/);

  return parseDocxLinesToCourses(lines);
}

function parseXlsxRowsToCourses(rows: string[][]): ParsedMasterCourse[] {
  const courses: ParsedMasterCourse[] = [];
  let electiveGroup: string | null = null;
  let currentLevelTerm: string | null = null;

  for (const row of rows) {
    const rawCells = row.map((cell) => String(cell ?? ""));
    const cells = rawCells.map((cell) => normalizeWhitespace(cell)).filter(Boolean);

    if (cells.length === 0) continue;

    const joined = cells.join(" ").trim();

    const groupMatch = joined.match(/^Group\s*-\s*([A-Z0-9]+)/i);
    if (groupMatch) {
      electiveGroup = groupMatch[1].toUpperCase();
      continue;
    }

    const explicitLevelTerm = parseExplicitLevelTerm(joined);
    if (explicitLevelTerm) {
      currentLevelTerm = explicitLevelTerm;
      continue;
    }

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

    const built = buildCourse(
      codeRaw,
      titleRaw,
      creditRaw,
      electiveGroup,
      currentLevelTerm
    );

    if (built) {
      courses.push(built);
    }
  }

  return deduplicateCourses(courses);
}

export async function parseXlsxCourseList(
  buffer: Buffer
): Promise<ParsedMasterCourse[]> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const allCourses: ParsedMasterCourse[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    const normalizedRows = rows.map((row) =>
      row.map((cell) => String(cell ?? ""))
    );

    const courses = parseXlsxRowsToCourses(normalizedRows).map((course) => ({
      ...course,
      levelTerm: course.levelTerm || parseExplicitLevelTerm(sheetName) || null,
    }));

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

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsxCourseList(buffer);
  }

  throw new Error("Only .docx, .xlsx, and .xls master course list files are supported.");
}
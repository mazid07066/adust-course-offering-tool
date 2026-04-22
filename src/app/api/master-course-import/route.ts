import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { resolveCanonicalProgram } from "@/lib/canonical-program";

const ROUTE_VERSION = "master-course-import-final-no-tx-v4";

type ParsedCourse = {
  course_code: string;
  course_title: string;
  normalized_title: string;
  credit: number;
  course_type: string;
  level_term: string | null;
  group_name: string | null;
  is_active: boolean;
};

type CatalogProgram = {
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: string;
  curriculumVersion: string;
  curriculumKey: string | null;
  studentIdSuffix: string | null;
  displayLabel: string;
};

function normalizeText(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeTitle(text: string) {
  return normalizeText(text).toLowerCase();
}

function toCompactCourseCode(text: string) {
  const raw = normalizeText(text).toUpperCase();
  if (!raw) return "";

  const compact = raw.replace(/\s+/g, "");

  const directMatch = compact.match(/^([A-Z]{2,6})(\d{3,4})$/);
  if (directMatch) return `${directMatch[1]}${directMatch[2]}`;

  const spacedMatch = raw.match(/^([A-Z]{2,6})(?:\s+\d{2,4})?\s+(\d{3,4})$/);
  if (spacedMatch) return `${spacedMatch[1]}${spacedMatch[2]}`;

  const genericMatch = compact.match(/^([A-Z]{2,6}).*?(\d{3,4})$/);
  if (genericMatch) return `${genericMatch[1]}${genericMatch[2]}`;

  return compact;
}

function detectCourseType(rawType: string, rawTitle: string) {
  const type = normalizeText(rawType).toUpperCase();
  const title = normalizeText(rawTitle).toUpperCase();

  if (type.includes("LAB") || title.includes(" LAB")) return "LAB";
  if (type.includes("PROJECT") || title.includes("PROJECT")) return "PROJECT";
  if (type.includes("INTERNSHIP") || title.includes("INTERNSHIP")) return "INTERNSHIP";
  return "THEORY";
}

function isLikelyCourseCode(value: string) {
  const v = normalizeText(value).toUpperCase();
  return /^[A-Z]{2,6}\s*\d{3,4}(?:\s*\d{3,4})?$/.test(v);
}

function isNumericCredit(value: string) {
  return /^\d+(\.\d+)?$/.test(normalizeText(value));
}

function extractGroupName(text: string) {
  const value = normalizeText(text);
  if (!value) return null;

  if (/group\s*-\s*[a-z0-9]+/i.test(value)) return value;
  if (/ged|general education|language/i.test(value)) return value;
  if (/basic science|mathematics/i.test(value)) return value;
  if (/other engineering/i.test(value)) return value;
  if (/core courses?/i.test(value)) return value;
  if (/elective courses?/i.test(value)) return value;
  if (
    /electronics|biomedical|communication|power division|computer engineering/i.test(
      value
    )
  ) {
    return value;
  }

  return null;
}

function parseExcel(buffer: Buffer): ParsedCourse[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const courses: ParsedCourse[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    for (const row of rows) {
      const rowValues = Object.values(row)
        .map((v) => normalizeText(String(v || "")))
        .filter(Boolean);

      const joined = rowValues.join(" | ");
      const foundGroup = extractGroupName(joined);

      let code = "";
      let title = "";
      let credit = "";

      for (let i = 0; i < rowValues.length; i++) {
        const current = rowValues[i];
        const next = rowValues[i + 1] || "";
        const next2 = rowValues[i + 2] || "";

        if (!code && isLikelyCourseCode(current)) {
          code = current;

          if (!title && next && !isNumericCredit(next) && !isLikelyCourseCode(next)) {
            title = next;
          }

          if (!credit && isNumericCredit(next2)) {
            credit = next2;
          } else if (!credit && isNumericCredit(next)) {
            credit = next;
          }
        }
      }

      if (!code || !title || !credit) continue;
      if (/course code|course title|credit/i.test(joined)) continue;

      courses.push({
        course_code: toCompactCourseCode(code),
        course_title: normalizeText(title),
        normalized_title: normalizeTitle(title),
        credit: Number(credit),
        course_type: detectCourseType("", title),
        level_term: sheetName || null,
        group_name: foundGroup,
        is_active: true,
      });
    }
  }

  return courses;
}

function parseHtmlTables(html: string): ParsedCourse[] {
  const courses: ParsedCourse[] = [];
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  let currentGroup: string | null = null;

  for (const tableHtml of tableMatches) {
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    for (const rowHtml of rowMatches) {
      const cellMatches = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        (m) =>
          normalizeText(
            m[1]
              .replace(/<br\s*\/?>/gi, " ")
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/gi, " ")
          )
      );

      if (!cellMatches.length) continue;

      const rowText = cellMatches.join(" | ");
      const foundGroup = extractGroupName(rowText);
      if (foundGroup) currentGroup = foundGroup;

      if (cellMatches.some((c) => /course code/i.test(c))) continue;
      if (cellMatches.every((c) => !c)) continue;

      let code = "";
      let title = "";
      let credit = "";

      for (let i = 0; i < cellMatches.length; i++) {
        const current = cellMatches[i];
        const next = cellMatches[i + 1] || "";
        const next2 = cellMatches[i + 2] || "";

        if (!code && isLikelyCourseCode(current)) {
          code = current;

          if (!title && next && !isLikelyCourseCode(next) && !isNumericCredit(next)) {
            title = next;
          }

          if (!credit && isNumericCredit(next2)) {
            credit = next2;
          } else if (!credit && isNumericCredit(next)) {
            credit = next;
          }
        }
      }

      if (!code || !title || !credit) continue;

      courses.push({
        course_code: toCompactCourseCode(code),
        course_title: normalizeText(title),
        normalized_title: normalizeTitle(title),
        credit: Number(credit),
        course_type: detectCourseType("", title),
        level_term: null,
        group_name: currentGroup,
        is_active: true,
      });
    }
  }

  return courses;
}

function parseDocxRawText(text: string): ParsedCourse[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const courses: ParsedCourse[] = [];
  let currentGroup: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const foundGroup = extractGroupName(line);
    if (foundGroup) currentGroup = foundGroup;

    if (!isLikelyCourseCode(line)) continue;

    const next1 = lines[i + 1] || "";
    const next2 = lines[i + 2] || "";

    if (!next1 || !next2) continue;
    if (isLikelyCourseCode(next1)) continue;
    if (!isNumericCredit(next2)) continue;

    courses.push({
      course_code: toCompactCourseCode(line),
      course_title: normalizeText(next1),
      normalized_title: normalizeTitle(next1),
      credit: Number(next2),
      course_type: detectCourseType("", next1),
      level_term: null,
      group_name: currentGroup,
      is_active: true,
    });
  }

  return courses;
}

async function parseDocx(buffer: Buffer): Promise<ParsedCourse[]> {
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const htmlCourses = parseHtmlTables(htmlResult.value || "");
  if (htmlCourses.length > 0) return htmlCourses;

  const rawResult = await mammoth.extractRawText({ buffer });
  return parseDocxRawText(rawResult.value || "");
}

async function getCatalogProgramByCode(programCode: string): Promise<CatalogProgram | null> {
  const row = await prisma.academic_catalog_entries.findFirst({
    where: {
      program_code: programCode,
      is_active: true,
    },
  });

  if (!row) return null;

  return {
    departmentCode: row.department_code,
    departmentName: row.department_name,
    programCode: row.program_code,
    programTitle: row.program_title,
    programType: row.program_type,
    studyShift: row.study_shift,
    curriculumVersion: row.curriculum_version,
    curriculumKey: row.curriculum_key,
    studentIdSuffix: row.student_id_suffix,
    displayLabel: row.display_label,
  };
}

export async function GET() {
  await requireCoordinatorOrAdminApi();

  return NextResponse.json({
    ok: true,
    routeVersion: ROUTE_VERSION,
    message: "master-course-import route is active",
  });
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const formData = await request.formData();

    const programCode = String(formData.get("programCode") || "").trim().toUpperCase();
    const replaceExisting = String(formData.get("replaceExisting") || "false") === "true";
    const file = formData.get("file") as File | null;

    if (!programCode || !file) {
      return NextResponse.json(
        { error: "programCode and file are required.", routeVersion: ROUTE_VERSION },
        { status: 400 }
      );
    }

    const catalogProgram = await getCatalogProgramByCode(programCode);
    if (!catalogProgram) {
      return NextResponse.json(
        {
          error: "Selected program/curriculum is not defined in academic setup.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    const effectiveCurriculumKey =
      (catalogProgram.curriculumKey || "").trim().toUpperCase() || catalogProgram.programCode;

    const program = await resolveCanonicalProgram({
      department_code: catalogProgram.departmentCode,
      department_name: catalogProgram.departmentName,
      program_code: catalogProgram.programCode,
      program_title: catalogProgram.programTitle,
      study_shift: catalogProgram.studyShift,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const lowerName = file.name.toLowerCase();

    let courses: ParsedCourse[] = [];

    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      courses = parseExcel(buffer);
    } else if (
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".doc") ||
      lowerName.endsWith(".docm")
    ) {
      courses = await parseDocx(buffer);
    } else {
      return NextResponse.json(
        {
          error: "Unsupported file type. Please upload Excel or DOCX.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    const dedupedMap = new Map<string, ParsedCourse>();

    for (const c of courses) {
      const key = toCompactCourseCode(c.course_code);
      if (!key) continue;

      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, {
          ...c,
          course_code: key,
        });
      }
    }

    const dedupedCourses = Array.from(dedupedMap.values());

    if (!dedupedCourses.length) {
      return NextResponse.json(
        {
          error: "No course rows could be parsed from the uploaded file.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    const existingRows = await prisma.master_courses.findMany({
      where: {
        OR: [
          { curriculum_key: effectiveCurriculumKey },
          { program_id: program.id },
        ],
      },
      select: {
        id: true,
        course_code: true,
      },
      orderBy: [{ id: "asc" }],
    });

    const existingByCode = new Map<string, { id: number }>();

    for (const row of existingRows) {
      const compactCode = toCompactCourseCode(row.course_code);
      if (!compactCode) continue;
      if (!existingByCode.has(compactCode)) {
        existingByCode.set(compactCode, { id: row.id });
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const c of dedupedCourses) {
      const compactCode = toCompactCourseCode(c.course_code);
      if (!compactCode) continue;

      const existing = existingByCode.get(compactCode);

      if (existing) {
        await prisma.master_courses.update({
          where: { id: existing.id },
          data: {
            program_id: program.id,
            curriculum_key: effectiveCurriculumKey,
            course_code: compactCode,
            course_title: c.course_title,
            normalized_title: c.normalized_title,
            credit: c.credit,
            course_type: c.course_type,
            level_term: c.level_term,
            group_name: c.group_name,
            is_active: true,
          },
        });
        updatedCount += 1;
      } else {
        await prisma.master_courses.create({
          data: {
            program_id: program.id,
            curriculum_key: effectiveCurriculumKey,
            course_code: compactCode,
            course_title: c.course_title,
            normalized_title: c.normalized_title,
            credit: c.credit,
            course_type: c.course_type,
            level_term: c.level_term,
            group_name: c.group_name,
            is_active: true,
          },
        });
        insertedCount += 1;
      }
    }

    let deactivatedReferencedCount = 0;
    let deletedUnreferencedCount = 0;

    if (replaceExisting) {
      const incomingCodes = new Set(
        dedupedCourses.map((c) => toCompactCourseCode(c.course_code))
      );

      const staleRows = existingRows.filter((row) => {
        const compactCode = toCompactCourseCode(row.course_code);
        return compactCode && !incomingCodes.has(compactCode);
      });

      const staleIds = staleRows.map((row) => row.id);

      if (staleIds.length > 0) {
        const referencedRows = await prisma.offered_courses.findMany({
          where: {
            master_course_id: {
              in: staleIds,
            },
          },
          select: {
            master_course_id: true,
          },
          distinct: ["master_course_id"],
        });

        const referencedIds = new Set(
          referencedRows.map((row) => row.master_course_id)
        );

        const referencedStaleIds = staleIds.filter((id) => referencedIds.has(id));
        const unreferencedStaleIds = staleIds.filter((id) => !referencedIds.has(id));

        if (referencedStaleIds.length > 0) {
          const updated = await prisma.master_courses.updateMany({
            where: {
              id: { in: referencedStaleIds },
            },
            data: {
              is_active: false,
            },
          });
          deactivatedReferencedCount = updated.count;
        }

        if (unreferencedStaleIds.length > 0) {
          const deleted = await prisma.master_courses.deleteMany({
            where: {
              id: { in: unreferencedStaleIds },
            },
          });
          deletedUnreferencedCount = deleted.count;
        }
      }
    }

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      message: `Curriculum import completed successfully for ${effectiveCurriculumKey}. Inserted ${insertedCount}, updated ${updatedCount}, deactivated referenced stale ${deactivatedReferencedCount}, deleted unreferenced stale ${deletedUnreferencedCount}.`,
      insertedCount,
      updatedCount,
      deactivatedReferencedCount,
      deletedUnreferencedCount,
      parsedCount: dedupedCourses.length,
      programCode: catalogProgram.programCode,
      curriculumKey: effectiveCurriculumKey,
      departmentCode: catalogProgram.departmentCode,
      departmentName: catalogProgram.departmentName,
      programName: catalogProgram.programTitle,
    });
  } catch (error) {
    console.error("MASTER COURSE IMPORT ERROR", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Master course import failed.",
        routeVersion: ROUTE_VERSION,
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ROUTE_VERSION = "master-course-import-rae-unique-safe-v2";

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
  id: number;
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

function normalizeHeader(value: string) {
  return normalizeText(value).toLowerCase();
}

function pickHeaderValue(row: Record<string, unknown>, candidates: string[]) {
  const entries = Object.entries(row);

  for (const [key, value] of entries) {
    const normalizedKey = normalizeHeader(key);
    if (candidates.includes(normalizedKey)) {
      return normalizeText(String(value ?? ""));
    }
  }

  return "";
}

function parseExcelStrict(buffer: Buffer): ParsedCourse[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const courses: ParsedCourse[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    for (const row of rows) {
      const code =
        pickHeaderValue(row, ["course code", "coursecode", "code"]) || "";

      const title =
        pickHeaderValue(row, [
          "course title",
          "coursetitle",
          "title",
          "course name",
          "coursename",
          "description",
        ]) || "";

      const credit =
        pickHeaderValue(row, [
          "credit",
          "credits",
          "credit hour",
          "credit hours",
          "credithour",
          "credithours",
        ]) || "";

      const type =
        pickHeaderValue(row, ["type", "course type", "coursetype"]) || "";

      const levelTerm =
        pickHeaderValue(row, [
          "level / term",
          "level/term",
          "level term",
          "level_term",
          "semester",
          "term",
        ]) || "";

      const groupName =
        pickHeaderValue(row, ["group", "group name", "group_name", "category"]) || "";

      if (!code || !title || !credit) continue;
      if (!isLikelyCourseCode(code)) continue;
      if (!isNumericCredit(credit)) continue;

      courses.push({
        course_code: toCompactCourseCode(code),
        course_title: normalizeText(title),
        normalized_title: normalizeTitle(title),
        credit: Number(credit),
        course_type: detectCourseType(type, title),
        level_term: levelTerm ? normalizeText(levelTerm) : null,
        group_name: groupName ? normalizeText(groupName) : null,
        is_active: true,
      });
    }
  }

  return courses;
}

function parseHtmlTables(html: string): ParsedCourse[] {
  const courses: ParsedCourse[] = [];
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];

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
      if (cellMatches.some((c) => /course code|course title|credit/i.test(c))) continue;

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
        group_name: null,
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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
      group_name: null,
      is_active: true,
    });
  }

  return courses;
}

async function parseDocx(buffer: Buffer): Promise<ParsedCourse[]> {
  const result = await mammoth.extractRawText({ buffer });
  const rawTextCourses = parseDocxRawText(result.value || "");

  if (rawTextCourses.length > 0) {
    return rawTextCourses;
  }

  const htmlResult = await mammoth.convertToHtml({ buffer });
  return parseHtmlTables(htmlResult.value || "");
}

function dedupeCourses(courses: ParsedCourse[]) {
  const map = new Map<string, ParsedCourse>();

  for (const course of courses) {
    const key = toCompactCourseCode(course.course_code);
    if (!key) continue;

    map.set(key, {
      ...course,
      course_code: key,
      course_title: normalizeText(course.course_title),
      normalized_title: normalizeTitle(course.course_title),
      level_term: course.level_term ? normalizeText(course.level_term) : null,
      group_name: course.group_name ? normalizeText(course.group_name) : null,
      course_type: detectCourseType(course.course_type, course.course_title),
      is_active: true,
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.course_code.localeCompare(b.course_code)
  );
}

async function getCatalogProgram(programCode: string): Promise<CatalogProgram | null> {
  const entry = await prisma.academic_catalog_entries.findUnique({
    where: {
      program_code: programCode,
    },
  });

  if (!entry) return null;

  return {
    id: entry.id,
    departmentCode: entry.department_code,
    departmentName: entry.department_name,
    programCode: entry.program_code,
    programTitle: entry.program_title,
    programType: entry.program_type,
    studyShift: entry.study_shift,
    curriculumVersion: entry.curriculum_version,
    curriculumKey: entry.curriculum_key,
    studentIdSuffix: entry.student_id_suffix,
    displayLabel: entry.display_label,
  };
}

async function resolveDepartmentId(departmentCode: string, departmentName: string) {
  const byShortName = await prisma.departments.findFirst({
    where: {
      short_name: departmentCode,
    },
  });

  if (byShortName) return byShortName.id;

  const byName = await prisma.departments.findFirst({
    where: {
      name: departmentName,
    },
  });

  if (byName) return byName.id;

  const created = await prisma.departments.create({
    data: {
      short_name: departmentCode,
      name: departmentName,
    },
  });

  return created.id;
}

async function resolveProgramRowForExactAcademicIdentity(catalogProgram: CatalogProgram) {
  const departmentId = await resolveDepartmentId(
    catalogProgram.departmentCode,
    catalogProgram.departmentName
  );

  const byShortName = await prisma.programs.findFirst({
    where: {
      short_name: catalogProgram.programCode,
    },
  });

  if (byShortName) {
    return byShortName;
  }

  const uniqueProgramName = catalogProgram.displayLabel;

  const byDepartmentAndName = await prisma.programs.findFirst({
    where: {
      department_id: departmentId,
      name: uniqueProgramName,
    },
  });

  if (byDepartmentAndName) {
    const updated = await prisma.programs.update({
      where: { id: byDepartmentAndName.id },
      data: {
        short_name: catalogProgram.programCode,
      },
    });
    return updated;
  }

  const created = await prisma.programs.create({
    data: {
      department_id: departmentId,
      name: uniqueProgramName,
      short_name: catalogProgram.programCode,
    },
  });

  return created;
}

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const formData = await request.formData();

    const programCode = normalizeText(String(formData.get("programCode") || "")).toUpperCase();
    const replaceExisting =
      String(formData.get("replaceExisting") || "").toLowerCase() === "true";

    const file = formData.get("file") as File | null;

    if (!programCode) {
      return NextResponse.json(
        { error: "programCode is required." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "Course list file is required." },
        { status: 400 }
      );
    }

    const catalogProgram = await getCatalogProgram(programCode);

    if (!catalogProgram) {
      return NextResponse.json(
        { error: "Academic identity not found in Academic Setup." },
        { status: 404 }
      );
    }

    const exactProgramRow = await resolveProgramRowForExactAcademicIdentity(catalogProgram);

    const effectiveCurriculumKey =
      catalogProgram.curriculumKey || catalogProgram.programCode;

    const buffer = Buffer.from(await file.arrayBuffer());
    const lowerName = file.name.toLowerCase();

    let parsedCourses: ParsedCourse[] = [];

    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      parsedCourses = parseExcelStrict(buffer);
    } else if (lowerName.endsWith(".docx")) {
      parsedCourses = await parseDocx(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use .xlsx, .xls, or .docx" },
        { status: 400 }
      );
    }

    const dedupedCourses = dedupeCourses(parsedCourses);

    if (dedupedCourses.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid courses could be parsed. Make sure the file has explicit columns like Course Code, Course Title, and Credit/Credits.",
        },
        { status: 400 }
      );
    }

    const existingRowsForCurriculum = await prisma.master_courses.findMany({
      where: {
        curriculum_key: effectiveCurriculumKey,
      },
      orderBy: [{ course_code: "asc" }],
    });

    const existingRowsForProgram = await prisma.master_courses.findMany({
      where: {
        program_id: exactProgramRow.id,
      },
      orderBy: [{ course_code: "asc" }],
    });

    const existingByCurriculumCode = new Map(
      existingRowsForCurriculum.map((row) => [toCompactCourseCode(row.course_code), row])
    );

    const existingByProgramCode = new Map(
      existingRowsForProgram.map((row) => [toCompactCourseCode(row.course_code), row])
    );

    let insertedCount = 0;
    let updatedCount = 0;

    for (const c of dedupedCourses) {
      const compactCode = toCompactCourseCode(c.course_code);
      if (!compactCode) continue;

      const existingForCurriculum = existingByCurriculumCode.get(compactCode);
      const existingForProgram = existingByProgramCode.get(compactCode);
      const existing = existingForCurriculum || existingForProgram || null;

      if (existing) {
        await prisma.master_courses.update({
          where: {
            id: existing.id,
          },
          data: {
            program_id: exactProgramRow.id,
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
            program_id: exactProgramRow.id,
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

      const staleRows = existingRowsForCurriculum.filter((row) => {
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
      exactProgramRowId: exactProgramRow.id,
      exactProgramShortName: exactProgramRow.short_name,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Master course import failed.",
      },
      { status: 500 }
    );
  }
}
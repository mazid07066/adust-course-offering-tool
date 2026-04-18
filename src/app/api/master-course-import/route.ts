import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

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
  studentIdSuffix: string | null;
  displayLabel: string;
};

function normalizeText(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeTitle(text: string) {
  return normalizeText(text).toLowerCase();
}

function normalizeCourseCode(text: string) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
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
  return /^[A-Z]{2,6}\s*\d{2,4}(?:\s*\d{2,4})?$/.test(v);
}

function isNumericCredit(value: string) {
  return /^\d+(\.\d+)?$/.test(normalizeText(value));
}

function extractGroupName(text: string) {
  const value = normalizeText(text);
  if (!value) return null;

  if (/group\s*-\s*[a-z0-9]+/i.test(value)) return value;
  if (/ged|general education/i.test(value)) return value;
  if (/basic science|mathematics/i.test(value)) return value;
  if (/other engineering/i.test(value)) return value;
  if (/core courses?/i.test(value)) return value;
  if (/elective courses?/i.test(value)) return value;
  if (/electronics|biomedical|communication|power division|computer engineering/i.test(value)) {
    return value;
  }

  return null;
}

function parseExcel(buffer: Buffer): ParsedCourse[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const courses: ParsedCourse[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    for (const row of rows) {
      const rowValues = Object.values(row).map((v) => normalizeText(String(v || "")));
      const joined = rowValues.join(" | ");

      const code =
        row["Code"] ||
        row["Course Code"] ||
        row["course_code"] ||
        row["COURSE CODE"] ||
        rowValues.find((v) => isLikelyCourseCode(v)) ||
        "";

      const title =
        row["Title"] ||
        row["Course Title"] ||
        row["course_title"] ||
        row["COURSE TITLE"] ||
        (() => {
          const idx = rowValues.findIndex((v) => isLikelyCourseCode(v));
          if (idx >= 0 && rowValues[idx + 1] && !isNumericCredit(rowValues[idx + 1])) {
            return rowValues[idx + 1];
          }
          return "";
        })();

      const credit =
        row["Credit"] ||
        row["Credits"] ||
        row["Credit Hour"] ||
        row["Credit Hours"] ||
        row["credit"] ||
        row["CREDIT"] ||
        rowValues.find((v) => isNumericCredit(v)) ||
        0;

      if (!String(code).trim() || !String(title).trim()) continue;
      if (/course code|course title|credit/i.test(joined)) continue;

      courses.push({
        course_code: normalizeCourseCode(String(code)),
        course_title: normalizeText(String(title)),
        normalized_title: normalizeTitle(String(title)),
        credit: Number(credit || 0),
        course_type: detectCourseType("", String(title)),
        level_term: sheetName || null,
        group_name: null,
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
      const cellMatches = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
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
      if (foundGroup) {
        currentGroup = foundGroup;
      }

      if (cellMatches.some((c) => /course code/i.test(c))) continue;
      if (cellMatches.every((c) => !c)) continue;

      let code = "";
      let title = "";
      let credit = "";

      if (cellMatches.length >= 3) {
        if (isLikelyCourseCode(cellMatches[0])) {
          code = cellMatches[0];

          if (cellMatches.length >= 4 && isLikelyCourseCode(cellMatches[1])) {
            title = cellMatches[2];
            credit = cellMatches[3] || "";
          } else {
            title = cellMatches[1];
            credit = cellMatches[2] || "";
          }
        }
      }

      if (!code || !title) continue;
      if (!isNumericCredit(credit)) continue;

      courses.push({
        course_code: normalizeCourseCode(code),
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
    if (foundGroup) {
      currentGroup = foundGroup;
    }

    if (!isLikelyCourseCode(line)) continue;

    const next1 = lines[i + 1] || "";
    const next2 = lines[i + 2] || "";

    if (!next1 || !next2) continue;
    if (isLikelyCourseCode(next1)) continue;
    if (!isNumericCredit(next2)) continue;

    const title = next1;
    const credit = Number(next2);

    courses.push({
      course_code: normalizeCourseCode(line),
      course_title: normalizeText(title),
      normalized_title: normalizeTitle(title),
      credit,
      course_type: detectCourseType("", title),
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
  if (htmlCourses.length > 0) {
    return htmlCourses;
  }

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
    studentIdSuffix: row.student_id_suffix,
    displayLabel: row.display_label,
  };
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
        { error: "programCode and file are required." },
        { status: 400 }
      );
    }

    const catalogProgram = await getCatalogProgramByCode(programCode);
    if (!catalogProgram) {
      return NextResponse.json(
        { error: "Selected program/curriculum is not defined in academic setup." },
        { status: 400 }
      );
    }

    let department = await prisma.departments.findFirst({
      where: {
        OR: [
          { short_name: catalogProgram.departmentCode },
          { name: catalogProgram.departmentName },
        ],
      },
    });

    if (!department) {
      department = await prisma.departments.create({
        data: {
          name: catalogProgram.departmentName,
          short_name: catalogProgram.departmentCode,
        },
      });
    } else {
      const anotherWithSameName = await prisma.departments.findFirst({
        where: {
          name: catalogProgram.departmentName,
          NOT: { id: department.id },
        },
      });

      if (!anotherWithSameName) {
        department = await prisma.departments.update({
          where: { id: department.id },
          data: {
            name: catalogProgram.departmentName,
            short_name: catalogProgram.departmentCode,
          },
        });
      } else {
        department = await prisma.departments.update({
          where: { id: department.id },
          data: {
            short_name: catalogProgram.departmentCode,
          },
        });
      }
    }

    const existingProgram = await prisma.programs.findFirst({
      where: {
        OR: [
          { short_name: catalogProgram.programCode },
          { name: catalogProgram.programTitle },
        ],
      },
    });

    const program = existingProgram
      ? await prisma.programs.update({
          where: { id: existingProgram.id },
          data: {
            name: catalogProgram.programTitle,
            short_name: catalogProgram.programCode,
            department_id: department.id,
          },
        })
      : await prisma.programs.create({
          data: {
            name: catalogProgram.programTitle,
            short_name: catalogProgram.programCode,
            department_id: department.id,
          },
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
        { error: "Unsupported file type. Please upload Excel or DOCX." },
        { status: 400 }
      );
    }

    const dedupedMap = new Map<string, ParsedCourse>();
    for (const c of courses) {
      const key = normalizeCourseCode(c.course_code);
      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, c);
      }
    }

    const dedupedCourses = Array.from(dedupedMap.values());

    if (!dedupedCourses.length) {
      return NextResponse.json(
        { error: "No course rows could be parsed from the uploaded file." },
        { status: 400 }
      );
    }

    if (replaceExisting) {
      await prisma.master_courses.deleteMany({
        where: { program_id: program.id },
      });
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const c of dedupedCourses) {
      const existing = await prisma.master_courses.findFirst({
        where: {
          program_id: program.id,
          course_code: c.course_code,
        },
      });

      if (existing) {
        await prisma.master_courses.update({
          where: { id: existing.id },
          data: {
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
            course_code: c.course_code,
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

    return NextResponse.json({
      success: true,
      message: `Master course import completed successfully for ${catalogProgram.programCode}. Inserted ${insertedCount}, updated ${updatedCount}.`,
      insertedCount,
      updatedCount,
      parsedCount: dedupedCourses.length,
      programCode: catalogProgram.programCode,
      programName: catalogProgram.programTitle,
      departmentCode: catalogProgram.departmentCode,
      departmentName: catalogProgram.departmentName,
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
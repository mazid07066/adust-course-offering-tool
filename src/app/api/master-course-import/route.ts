import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";

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

function normalizeText(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeTitle(text: string) {
  return normalizeText(text).toLowerCase();
}

function normalizeCourseCode(text: string) {
  return String(text || "").replace(/\s+/g, "").trim().toUpperCase();
}

function detectCourseType(rawType: string, rawTitle: string) {
  const type = normalizeText(rawType).toUpperCase();
  const title = normalizeText(rawTitle).toUpperCase();

  if (type.includes("LAB") || title.includes(" LAB")) return "LAB";
  if (type.includes("PROJECT") || title.includes("PROJECT")) return "PROJECT";
  if (type.includes("INTERNSHIP") || title.includes("INTERNSHIP")) return "INTERNSHIP";
  return "THEORY";
}

function parseExcel(buffer: Buffer): ParsedCourse[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const courses: ParsedCourse[] = [];

  for (const row of rows) {
    const code =
      row["Code"] ||
      row["Course Code"] ||
      row["course_code"] ||
      row["COURSE CODE"] ||
      "";

    const title =
      row["Title"] ||
      row["Course Title"] ||
      row["course_title"] ||
      row["COURSE TITLE"] ||
      "";

    if (!String(code).trim() || !String(title).trim()) continue;

    const credit =
      row["Credit"] ||
      row["Credits"] ||
      row["Credit Hour"] ||
      row["Credit Hours"] ||
      row["credit"] ||
      row["CREDIT"] ||
      0;

    const type =
      row["Type"] ||
      row["type"] ||
      row["TYPE"] ||
      "";

    const levelTerm =
      row["Level Term"] ||
      row["Level"] ||
      row["Semester"] ||
      row["level_term"] ||
      row["LEVEL TERM"] ||
      null;

    const group =
      row["Group"] ||
      row["Category"] ||
      row["group_name"] ||
      row["GROUP"] ||
      null;

    courses.push({
      course_code: normalizeCourseCode(String(code)),
      course_title: normalizeText(String(title)),
      normalized_title: normalizeTitle(String(title)),
      credit: Number(credit || 0),
      course_type: detectCourseType(String(type), String(title)),
      level_term: levelTerm ? normalizeText(String(levelTerm)) : null,
      group_name: group ? normalizeText(String(group)) : null,
      is_active: true,
    });
  }

  return courses;
}

function parseDocxTableText(text: string): ParsedCourse[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const courses: ParsedCourse[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const codeMatch = line.match(/\b([A-Z]{2,4}\s?\d{3,4}\s?\d{4}|[A-Z]{2,4}\s?\d{3,4}[A-Z]?|[A-Z]{2,4}\d{3,4}[A-Z]?)\b/i);
    if (!codeMatch) continue;

    const courseCode = normalizeCourseCode(codeMatch[1]);

    const next1 = lines[i + 1] || "";
    const next2 = lines[i + 2] || "";

    let title = "";
    let credit = 0;

    if (next1 && !/\b\d+(\.\d+)?\b/.test(next1)) {
      title = next1;
      const creditMatch = next2.match(/\b(\d+(?:\.\d+)?)\b/);
      if (creditMatch) {
        credit = Number(creditMatch[1]);
      }
    } else {
      const inlineTitle = normalizeText(line.replace(codeMatch[1], ""));
      title = inlineTitle;
      const creditMatch = line.match(/\b(\d+(?:\.\d+)?)\b/g);
      if (creditMatch?.length) {
        credit = Number(creditMatch[creditMatch.length - 1]);
      }
    }

    if (!title) continue;

    courses.push({
      course_code: courseCode,
      course_title: normalizeText(title),
      normalized_title: normalizeTitle(title),
      credit,
      course_type: detectCourseType("", title),
      level_term: null,
      group_name: null,
      is_active: true,
    });
  }

  return courses;
}

async function parseDocx(buffer: Buffer): Promise<ParsedCourse[]> {
  const result = await mammoth.extractRawText({ buffer });
  return parseDocxTableText(result.value || "");
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const formData = await request.formData();

    const programCode = String(formData.get("programCode") || "")
      .trim()
      .toUpperCase();
    const replaceExisting =
      String(formData.get("replaceExisting") || "false") === "true";
    const file = formData.get("file") as File | null;

    if (!programCode || !file) {
      return NextResponse.json(
        { error: "programCode and file are required." },
        { status: 400 }
      );
    }

    const catalogProgram = getCatalogProgramByCode(programCode);
    if (!catalogProgram) {
      return NextResponse.json(
        { error: "Selected program/curriculum is not defined in the academic catalog." },
        { status: 400 }
      );
    }

    const existingDepartment = await prisma.departments.findFirst({
      where: { short_name: catalogProgram.departmentCode },
    });

    const department = existingDepartment
      ? await prisma.departments.update({
          where: { id: existingDepartment.id },
          data: {
            name: catalogProgram.departmentName,
            short_name: catalogProgram.departmentCode,
          },
        })
      : await prisma.departments.create({
          data: {
            name: catalogProgram.departmentName,
            short_name: catalogProgram.departmentCode,
          },
        });

    const existingProgram = await prisma.programs.findFirst({
      where: { short_name: catalogProgram.programCode },
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
    let courses: ParsedCourse[] = [];

    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      courses = parseExcel(buffer);
    } else if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc") || lowerName.endsWith(".docm")) {
      courses = await parseDocx(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload Excel or DOCX." },
        { status: 400 }
      );
    }

    if (!courses.length) {
      return NextResponse.json(
        { error: "No course rows could be parsed from the uploaded file." },
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
        error:
          error instanceof Error ? error.message : "Master course import failed.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeText(value: string) {
  return value.trim();
}

function normalizeUpper(value: string) {
  return value.trim().toUpperCase();
}

function buildDisplayLabel(input: {
  departmentCode: string;
  programTitle: string;
  studyShift: string;
  curriculumVersion: string;
}) {
  return `${input.departmentCode} | ${input.programTitle} | ${input.studyShift} | ${input.curriculumVersion}`;
}

export async function GET() {
  await requireCoordinatorOrAdminApi();

  const rows = await prisma.academic_catalog_entries.findMany({
    orderBy: [
      { department_code: "asc" },
      { program_title: "asc" },
      { study_shift: "asc" },
      { curriculum_version: "asc" },
    ],
  });

  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  await requireCoordinatorOrAdminApi();

  const body = await req.json();

  const departmentCode = normalizeUpper(body.departmentCode || "");
  const departmentName = normalizeText(body.departmentName || "");
  const programCode = normalizeUpper(body.programCode || "");
  const programTitle = normalizeText(body.programTitle || "");
  const programType = normalizeUpper(body.programType || "");
  const studyShift = normalizeUpper(body.studyShift || "");
  const curriculumVersion = normalizeUpper(body.curriculumVersion || "");
  const studentIdSuffixRaw = (body.studentIdSuffix || "").trim();
  const studentIdSuffix = studentIdSuffixRaw ? normalizeUpper(studentIdSuffixRaw) : null;
  const isActive = Boolean(body.isActive ?? true);

  if (!departmentCode) {
    return NextResponse.json({ error: "Department code is required." }, { status: 400 });
  }
  if (!departmentName) {
    return NextResponse.json({ error: "Department name is required." }, { status: 400 });
  }
  if (!programCode) {
    return NextResponse.json({ error: "Program code is required." }, { status: 400 });
  }
  if (!programTitle) {
    return NextResponse.json({ error: "Program title is required." }, { status: 400 });
  }
  if (!programType) {
    return NextResponse.json({ error: "Program type is required." }, { status: 400 });
  }
  if (!studyShift) {
    return NextResponse.json({ error: "Study shift is required." }, { status: 400 });
  }
  if (!curriculumVersion) {
    return NextResponse.json({ error: "Curriculum version is required." }, { status: 400 });
  }

  const displayLabel = buildDisplayLabel({
    departmentCode,
    programTitle,
    studyShift,
    curriculumVersion,
  });

  const saved = await prisma.academic_catalog_entries.upsert({
    where: { program_code: programCode },
    update: {
      department_code: departmentCode,
      department_name: departmentName,
      program_title: programTitle,
      program_type: programType,
      study_shift: studyShift,
      curriculum_version: curriculumVersion,
      student_id_suffix: studentIdSuffix,
      display_label: displayLabel,
      is_active: isActive,
    },
    create: {
      department_code: departmentCode,
      department_name: departmentName,
      program_code: programCode,
      program_title: programTitle,
      program_type: programType,
      study_shift: studyShift,
      curriculum_version: curriculumVersion,
      student_id_suffix: studentIdSuffix,
      display_label: displayLabel,
      is_active: isActive,
    },
  });

  return NextResponse.json({
    message: "Academic setup saved successfully.",
    item: saved,
  });
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCanonicalDepartment } from "@/lib/canonical-program";

type CatalogProgramRow = {
  id: number;
  department_code: string;
  department_name: string;
  program_code: string;
  program_title: string;
  program_type: string;
  study_shift: string;
  curriculum_version: string;
  curriculum_key: string | null;
  student_id_suffix: string | null;
  display_label: string;
  is_active: boolean;
};

function normalizeText(value: string) {
  return String(value || "").trim();
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function buildCanonicalProgramName(programTitle: string, studyShift: string) {
  return `${normalizeText(programTitle)} [${normalizeUpper(studyShift)}]`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programCode = String(searchParams.get("programCode") || "")
      .trim()
      .toUpperCase();

    if (!programCode) {
      return NextResponse.json({ batches: [] });
    }

    const academicIdentity = (await prisma.academic_catalog_entries.findFirst({
      where: {
        program_code: programCode,
        is_active: true,
      },
    })) as CatalogProgramRow | null;

    if (!academicIdentity) {
      return NextResponse.json({ batches: [] });
    }

    const department = await resolveCanonicalDepartment({
      department_code: academicIdentity.department_code,
      department_name: academicIdentity.department_name,
      program_code: academicIdentity.program_code,
      program_title: academicIdentity.program_title,
      study_shift: academicIdentity.study_shift,
    });

    const program = await prisma.programs.findFirst({
      where: {
        department_id: department.id,
        name: buildCanonicalProgramName(
          academicIdentity.program_title,
          academicIdentity.study_shift
        ),
      },
    });

    if (!program) {
      return NextResponse.json({ batches: [] });
    }

    const batches = await prisma.batches.findMany({
      where: {
        program_id: program.id,
      },
      orderBy: {
        batch_code: "asc",
      },
      select: {
        batch_code: true,
      },
    });

    return NextResponse.json({
      batches: batches.map((b) => b.batch_code),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load batches.",
      },
      { status: 500 }
    );
  }
}
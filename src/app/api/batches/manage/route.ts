import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source:
    | "EXACT_PROGRAM_CODE"
    | "CANONICAL_PROGRAM"
    | "CURRICULUM_RELATED_PROGRAM";
};

function uniqueById<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

async function getProgramCandidates(programCode: string): Promise<{
  requestedProgramCode: string;
  curriculumKey: string | null;
  candidates: ProgramCandidate[];
}> {
  const normalizedProgramCode = String(programCode || "").trim().toUpperCase();

  if (!normalizedProgramCode) {
    throw new Error("programCode is required.");
  }

  const staticCatalog = getCatalogProgramByCode(normalizedProgramCode);
  if (!staticCatalog) {
    throw new Error("Invalid academic identity programCode.");
  }

  const catalogEntry = await prisma.academic_catalog_entries.findUnique({
    where: {
      program_code: normalizedProgramCode,
    },
    select: {
      program_code: true,
      curriculum_key: true,
      department_code: true,
      department_name: true,
      program_title: true,
      study_shift: true,
    },
  });

  const candidates: ProgramCandidate[] = [];

  const exactProgram = await prisma.programs.findFirst({
    where: {
      short_name: normalizedProgramCode,
    },
    select: {
      id: true,
      short_name: true,
      name: true,
    },
  });

  if (exactProgram) {
    candidates.push({
      ...exactProgram,
      source: "EXACT_PROGRAM_CODE",
    });
  }

  const canonicalProgram = await resolveCanonicalProgram({
    department_code: catalogEntry?.department_code || staticCatalog.departmentCode,
    department_name: catalogEntry?.department_name || staticCatalog.departmentName,
    program_code: normalizedProgramCode,
    program_title: catalogEntry?.program_title || staticCatalog.programTitle,
    study_shift: catalogEntry?.study_shift || staticCatalog.studyShift,
  });

  if (!candidates.some((item) => item.id === canonicalProgram.id)) {
    candidates.push({
      id: canonicalProgram.id,
      short_name: canonicalProgram.short_name,
      name: canonicalProgram.name,
      source: "CANONICAL_PROGRAM",
    });
  }

  const curriculumKey = catalogEntry?.curriculum_key || null;

  if (curriculumKey) {
    const relatedPrograms = await prisma.programs.findMany({
      where: {
        master_courses: {
          some: {
            curriculum_key: curriculumKey,
          },
        },
      },
      select: {
        id: true,
        short_name: true,
        name: true,
      },
      orderBy: [{ short_name: "asc" }],
    });

    for (const program of relatedPrograms) {
      if (!candidates.some((item) => item.id === program.id)) {
        candidates.push({
          ...program,
          source: "CURRICULUM_RELATED_PROGRAM",
        });
      }
    }
  }

  return {
    requestedProgramCode: normalizedProgramCode,
    curriculumKey,
    candidates: uniqueById(candidates),
  };
}

function sourcePriority(source: ProgramCandidate["source"]) {
  switch (source) {
    case "EXACT_PROGRAM_CODE":
      return 1;
    case "CANONICAL_PROGRAM":
      return 2;
    case "CURRICULUM_RELATED_PROGRAM":
      return 3;
    default:
      return 999;
  }
}

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const rows = await prisma.batches.findMany({
      include: {
        programs: true,
      },
      orderBy: [{ batch_code: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      batches: rows.map((row) => ({
        id: row.id,
        programId: row.program_id,
        programCode: row.programs.short_name,
        programName: row.programs.name,
        batchCode: row.batch_code,
        admissionTerm: row.admission_term || "",
        active: Boolean(row.is_active),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "Failed to load batches." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();

    const requestedProgramCode = String(body.programCode || "")
      .trim()
      .toUpperCase();
    const batchCode = String(body.batchCode || "").trim().toUpperCase();
    const admissionTerm = String(body.admissionTerm || "").trim().toUpperCase();
    const isActive = body.isActive !== false;

    if (!requestedProgramCode) {
      return NextResponse.json(
        { ok: false, error: "programCode is required." },
        { status: 400 }
      );
    }

    if (!batchCode) {
      return NextResponse.json(
        { ok: false, error: "batchCode is required." },
        { status: 400 }
      );
    }

    const resolved = await getProgramCandidates(requestedProgramCode);

    if (resolved.candidates.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No target program could be resolved." },
        { status: 400 }
      );
    }

    const targetProgram = [...resolved.candidates].sort((a, b) => {
      return sourcePriority(a.source) - sourcePriority(b.source);
    })[0];

    const existing = await prisma.batches.findFirst({
      where: {
        program_id: targetProgram.id,
        batch_code: batchCode,
      },
      include: {
        programs: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: `Batch ${batchCode} already exists under ${existing.programs.short_name}.`,
        },
        { status: 400 }
      );
    }

    const created = await prisma.batches.create({
      data: {
        program_id: targetProgram.id,
        batch_code: batchCode,
        admission_term: admissionTerm || null,
        is_active: isActive,
      },
      include: {
        programs: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Batch created successfully.",
      batch: {
        id: created.id,
        programId: created.program_id,
        programCode: created.programs.short_name,
        programName: created.programs.name,
        batchCode: created.batch_code,
        admissionTerm: created.admission_term || "",
        active: Boolean(created.is_active),
      },
      resolvedProgram: {
        requestedProgramCode,
        actualProgramCode: created.programs.short_name,
        actualProgramName: created.programs.name,
      },
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Failed to create batch.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
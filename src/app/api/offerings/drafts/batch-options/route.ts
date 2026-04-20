import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
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

async function getProgramCandidates(programCode: string): Promise<ProgramCandidate[]> {
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
      department_code: true,
      department_name: true,
      program_title: true,
      study_shift: true,
      curriculum_key: true,
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
    candidates.push(exactProgram);
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
    });
  }

  const curriculumKey = catalogEntry?.curriculum_key || null;

  if (curriculumKey) {
    const relatedCatalogEntries = await prisma.academic_catalog_entries.findMany({
      where: {
        curriculum_key: curriculumKey,
        is_active: true,
      },
      select: {
        program_code: true,
      },
    });

    const relatedProgramCodes = relatedCatalogEntries
      .map((item) => item.program_code)
      .filter(Boolean);

    if (relatedProgramCodes.length > 0) {
      const relatedPrograms = await prisma.programs.findMany({
        where: {
          short_name: {
            in: relatedProgramCodes,
          },
        },
        select: {
          id: true,
          short_name: true,
          name: true,
        },
      });

      for (const item of relatedPrograms) {
        if (!candidates.some((row) => row.id === item.id)) {
          candidates.push(item);
        }
      }
    }
  }

  return uniqueById(candidates);
}

export async function GET(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const { searchParams } = new URL(req.url);
    const programCode = String(searchParams.get("programCode") || "").trim().toUpperCase();

    if (!programCode) {
      return NextResponse.json(
        { ok: false, error: "programCode is required." },
        { status: 400 }
      );
    }

    const candidates = await getProgramCandidates(programCode);

    const rows = await prisma.batches.findMany({
      where: {
        program_id: {
          in: candidates.map((item) => item.id),
        },
      },
      select: {
        id: true,
        batch_code: true,
        program_id: true,
        programs: {
          select: {
            short_name: true,
            name: true,
          },
        },
      },
      orderBy: [{ batch_code: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      batches: rows.map((row) => ({
        id: row.id,
        batch_code: row.batch_code,
        program_code: row.programs.short_name,
        program_name: row.programs.name,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load batch options.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
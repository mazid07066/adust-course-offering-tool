import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source:
    | "EXACT_PROGRAM_CODE"
    | "CANONICAL_PROGRAM"
    | "CURRICULUM_RELATED_PROGRAM";
};

type BatchOption = {
  id: number;
  batchCode: string;
  admissionTerm: string | null;
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
          candidates.push({
            ...item,
            source: "CURRICULUM_RELATED_PROGRAM",
          });
        }
      }
    }
  }

  return {
    requestedProgramCode: normalizedProgramCode,
    curriculumKey,
    candidates: uniqueById(candidates),
  };
}

function sourcePriority(source: ProgramCandidate["source"]): number {
  if (source === "EXACT_PROGRAM_CODE") return 1;
  if (source === "CANONICAL_PROGRAM") return 2;
  return 3;
}

export async function GET(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const { searchParams } = new URL(req.url);
    const programCode = String(searchParams.get("programCode") || "").trim();

    if (!programCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "programCode is required.",
        },
        { status: 400 }
      );
    }

    const resolved = await getProgramCandidates(programCode);

    if (resolved.candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        batches: [],
      });
    }

    const rawBatches = await prisma.batches.findMany({
      where: {
        program_id: {
          in: resolved.candidates.map((item) => item.id),
        },
      },
      select: {
        id: true,
        batch_code: true,
        admission_term: true,
        program_id: true,
      },
      orderBy: [
        { batch_code: "asc" },
        { id: "asc" },
      ],
    });

    const programPriorityMap = new Map<number, number>();
    for (const candidate of resolved.candidates) {
      programPriorityMap.set(candidate.id, sourcePriority(candidate.source));
    }

    const bestByBatchCode = new Map<string, typeof rawBatches[number]>();

    for (const row of rawBatches) {
      const code = String(row.batch_code || "").trim();
      if (!code) continue;

      const existing = bestByBatchCode.get(code);

      if (!existing) {
        bestByBatchCode.set(code, row);
        continue;
      }

      const existingPriority = programPriorityMap.get(existing.program_id) ?? 999;
      const currentPriority = programPriorityMap.get(row.program_id) ?? 999;

      if (currentPriority < existingPriority) {
        bestByBatchCode.set(code, row);
        continue;
      }

      if (currentPriority === existingPriority) {
        const existingAdmission = String(existing.admission_term || "");
        const currentAdmission = String(row.admission_term || "");

        if (currentAdmission && !existingAdmission) {
          bestByBatchCode.set(code, row);
        }
      }
    }

    const batches: BatchOption[] = [...bestByBatchCode.values()]
      .sort((a, b) => {
        const numA = Number(a.batch_code);
        const numB = Number(b.batch_code);

        if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
          return numA - numB;
        }

        return a.batch_code.localeCompare(b.batch_code);
      })
      .map((row) => ({
        id: row.id,
        batchCode: row.batch_code,
        admissionTerm: row.admission_term || null,
      }));

    return NextResponse.json({
      ok: true,
      batches,
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
import { prisma } from "@/lib/prisma";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";

type ResolvedProgramResult = {
  requestedProgramCode: string;
  matchedProgramCodes: string[];
  program: {
    id: number;
    short_name: string;
    name: string;
  };
};

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source: "EXACT_PROGRAM_CODE" | "CANONICAL_PROGRAM";
};

function uniqueById<T extends { id: number }>(rows: T[]) {
  const seen = new Set<number>();
  const out: T[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

export async function resolveProgramForOfferingTemplate(programCode: string): Promise<ResolvedProgramResult> {
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

  const uniqueCandidates = uniqueById(candidates);

  if (uniqueCandidates.length === 0) {
    throw new Error("Selected academic identity could not be resolved to an internal program.");
  }

  return {
    requestedProgramCode: normalizedProgramCode,
    matchedProgramCodes: uniqueCandidates.map((item) => item.short_name),
    program: uniqueCandidates[0],
  };
}
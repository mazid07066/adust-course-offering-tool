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

  return uniqueById(candidates);
}

export async function GET(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const { searchParams } = new URL(req.url);
    const programCode = String(searchParams.get("programCode") || "").trim();
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();
    const batchCode = String(searchParams.get("batchCode") || "").trim();

    if (!programCode || !termName || !batchCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "programCode, termName, and batchCode are required.",
        },
        { status: 400 }
      );
    }

    const candidates = await getProgramCandidates(programCode);

    const drafts = await prisma.offerings.findMany({
      where: {
        status: "DRAFT",
        program_id: {
          in: candidates.map((item) => item.id),
        },
        academic_terms: {
          name: termName,
        },
      },
      orderBy: {
        id: "desc",
      },
      select: {
        id: true,
        offered_courses: {
          select: {
            id: true,
            master_course_id: true,
            master_courses: {
              select: {
                credit: true,
              },
            },
            offered_course_batches: {
              select: {
                batches: {
                  select: {
                    batch_code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const matchingDraft = drafts.find((draft) =>
      draft.offered_courses.some((course) =>
        course.offered_course_batches.some(
          (b) => String(b.batches.batch_code || "").trim() === batchCode
        )
      )
    ) || drafts[0] || null;

    if (!matchingDraft) {
      return NextResponse.json({
        ok: true,
        draftId: null,
        hiddenCourseIds: [],
        totalDraftCredits: 0,
      });
    }

    const offeredForBatch = matchingDraft.offered_courses.filter((course) =>
      course.offered_course_batches.some(
        (b) => String(b.batches.batch_code || "").trim() === batchCode
      )
    );

    const hiddenCourseIds = [...new Set(offeredForBatch.map((c) => c.master_course_id))];

    const totalDraftCredits = offeredForBatch.reduce((sum, row) => {
      return sum + Number(row.master_courses?.credit || 0);
    }, 0);

    return NextResponse.json({
      ok: true,
      draftId: matchingDraft.id,
      hiddenCourseIds,
      totalDraftCredits,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load draft context.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
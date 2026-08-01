import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import {
  isAcademicTermContextError,
  resolveAcademicTermContext,
} from "@/lib/academic-term-context";

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
    const guard = await requireCoordinatorOrAdminApi();
    if (guard instanceof Response) return guard;

    const { searchParams } = new URL(req.url);
    const programCode = String(searchParams.get("programCode") || "").trim();
    const requestedTermName = String(
      searchParams.get("termName") || ""
    )
      .trim()
      .toUpperCase();
    const batchCode = String(searchParams.get("batchCode") || "").trim();

    if (!programCode || !batchCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "programCode and batchCode are required.",
        },
        { status: 400 }
      );
    }

    const term = await resolveAcademicTermContext({
      termName: requestedTermName || undefined,
    });

    const candidates = await getProgramCandidates(programCode);
    const candidateProgramIds = candidates.map((item) => item.id);

    const drafts = await prisma.offerings.findMany({
      where: {
        status: {
          in: ["DRAFT", "BUFFER_READY"],
        },
        academic_term_id: term.id,
        program_id: {
          in: candidateProgramIds,
        },
      },
      orderBy: {
        id: "desc",
      },
      select: {
        id: true,
        status: true,
        program_id: true,
        offered_courses: {
          select: {
            id: true,
            master_course_id: true,
            master_courses: {
              select: {
                credit: true,
                program_id: true,
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

    const matchingDraft =
      drafts.find((draft) =>
        draft.offered_courses.some((course) =>
          course.offered_course_batches.some(
            (b) => String(b.batches.batch_code || "").trim() === batchCode
          )
        )
      ) ||
      drafts[0] ||
      null;

    if (!matchingDraft) {
      return NextResponse.json({
        ok: true,
        draftId: null,
        hiddenCourseIds: [],
        totalDraftCredits: 0,
        draftStatus: null,
      });
    }

    const offeredForBatchAndProgram = matchingDraft.offered_courses.filter((course) => {
      const sameBatch = course.offered_course_batches.some(
        (b) => String(b.batches.batch_code || "").trim() === batchCode
      );
      const sameProgramFamily = candidateProgramIds.includes(course.master_courses.program_id);

      return sameBatch && sameProgramFamily;
    });

    const hiddenCourseIds = [...new Set(offeredForBatchAndProgram.map((c) => c.master_course_id))];

    const totalDraftCredits = offeredForBatchAndProgram.reduce((sum, row) => {
      return sum + Number(row.master_courses?.credit || 0);
    }, 0);

    return NextResponse.json({
      ok: true,
      draftId: matchingDraft.id,
      hiddenCourseIds,
      totalDraftCredits,
      draftStatus: matchingDraft.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load draft context.";

    const status = isAcademicTermContextError(error)
      ? error.code === "ACADEMIC_TERM_NOT_FOUND"
        ? 404
        : 409
      : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
}

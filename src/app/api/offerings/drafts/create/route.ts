import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import {
  isAcademicTermContextError,
  resolveAcademicTermContext,
} from "@/lib/academic-term-context";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source:
    | "EXACT_PROGRAM_CODE"
    | "CANONICAL_PROGRAM"
    | "CURRICULUM_RELATED_PROGRAM";
};

type PrismaTx = any;

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

/*
 * Offering drafts must always prefer the canonical academic program.
 *
 * Operational / curriculum-specific program rows may coexist with
 * canonical programs because they serve historical student,
 * curriculum, migration, and administrative records.
 *
 * Course offering, however, is built on the canonical program/batch
 * layer.
 *
 * Therefore:
 *
 * 1. CANONICAL_PROGRAM
 * 2. EXACT_PROGRAM_CODE
 * 3. CURRICULUM_RELATED_PROGRAM
 */
function sourcePriority(source: ProgramCandidate["source"]): number {
  if (source === "CANONICAL_PROGRAM") return 1;
  if (source === "EXACT_PROGRAM_CODE") return 2;

  return 3;
}

async function getProgramCandidates(programCode: string): Promise<{
  requestedProgramCode: string;
  candidates: ProgramCandidate[];
}> {
  const normalizedProgramCode = String(programCode || "")
    .trim()
    .toUpperCase();

  if (!normalizedProgramCode) {
    throw new Error("programCode is required.");
  }

  const staticCatalog =
    getCatalogProgramByCode(normalizedProgramCode);

  if (!staticCatalog) {
    throw new Error(
      "Invalid academic identity programCode."
    );
  }

  const catalogEntry =
    await prisma.academic_catalog_entries.findUnique({
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

  /*
   * Resolve the canonical program first.
   *
   * This route is a write endpoint, so the existing writable
   * resolver remains appropriate here.
   */
  const canonicalProgram =
    await resolveCanonicalProgram({
      department_code:
        catalogEntry?.department_code ||
        staticCatalog.departmentCode,

      department_name:
        catalogEntry?.department_name ||
        staticCatalog.departmentName,

      program_code:
        normalizedProgramCode,

      program_title:
        catalogEntry?.program_title ||
        staticCatalog.programTitle,

      study_shift:
        catalogEntry?.study_shift ||
        staticCatalog.studyShift,
    });

  candidates.push({
    id: canonicalProgram.id,
    short_name: canonicalProgram.short_name,
    name: canonicalProgram.name,
    source: "CANONICAL_PROGRAM",
  });

  /*
   * Keep the exact operational program as a fallback candidate.
   *
   * It must not outrank the canonical program for offering
   * creation.
   */
  const exactProgram =
    await prisma.programs.findFirst({
      where: {
        short_name: normalizedProgramCode,
      },

      select: {
        id: true,
        short_name: true,
        name: true,
      },
    });

  if (
    exactProgram &&
    !candidates.some(
      (item) =>
        item.id === exactProgram.id
    )
  ) {
    candidates.push({
      ...exactProgram,
      source: "EXACT_PROGRAM_CODE",
    });
  }

  /*
   * Keep curriculum-related program rows as the final fallback.
   */
  const curriculumKey =
    catalogEntry?.curriculum_key || null;

  if (curriculumKey) {
    const relatedCatalogEntries =
      await prisma.academic_catalog_entries.findMany({
        where: {
          curriculum_key: curriculumKey,
          is_active: true,
        },

        select: {
          program_code: true,
        },
      });

    const relatedProgramCodes =
      relatedCatalogEntries
        .map(
          (item) =>
            item.program_code
        )
        .filter(Boolean);

    if (
      relatedProgramCodes.length >
      0
    ) {
      const relatedPrograms =
        await prisma.programs.findMany({
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

      for (
        const item
        of relatedPrograms
      ) {
        if (
          !candidates.some(
            (row) =>
              row.id === item.id
          )
        ) {
          candidates.push({
            ...item,
            source:
              "CURRICULUM_RELATED_PROGRAM",
          });
        }
      }
    }
  }

  return {
    requestedProgramCode:
      normalizedProgramCode,

    candidates:
      uniqueById(candidates),
  };
}

async function resolvePreparedByUserId() {
  const adminOrCoordinator =
    await prisma.users.findFirst({
      where: {
        is_active: true,

        role: {
          in: [
            "SUPER_ADMIN",
            "COORDINATOR",
          ],
        },
      },

      orderBy: {
        id: "asc",
      },

      select: {
        id: true,
      },
    });

  if (adminOrCoordinator) {
    return adminOrCoordinator.id;
  }

  const anyActiveUser =
    await prisma.users.findFirst({
      where: {
        is_active: true,
      },

      orderBy: {
        id: "asc",
      },

      select: {
        id: true,
      },
    });

  if (anyActiveUser) {
    return anyActiveUser.id;
  }

  throw new Error(
    "No active user found in users table. Please ensure at least one active SUPER_ADMIN or COORDINATOR user exists."
  );
}

async function deleteOfferedCourseCascade(
  tx: PrismaTx,
  offeredCourseId: number
) {
  await tx.faculty_course_selections.deleteMany({
    where: {
      offered_course_id:
        offeredCourseId,
    },
  });

  if (
    tx.offered_course_manual_cooffers
  ) {
    await tx.offered_course_manual_cooffers.deleteMany({
      where: {
        offered_course_id:
          offeredCourseId,
      },
    });
  }

  await tx.offered_course_slots.deleteMany({
    where: {
      offered_course_id:
        offeredCourseId,
    },
  });

  await tx.offered_course_teachers.deleteMany({
    where: {
      offered_course_id:
        offeredCourseId,
    },
  });

  await tx.offered_course_batches.deleteMany({
    where: {
      offered_course_id:
        offeredCourseId,
    },
  });

  await tx.offered_courses.delete({
    where: {
      id:
        offeredCourseId,
    },
  });
}

async function deduplicateDraftByLatest(
  offeringId: number
) {
  const rows =
    await prisma.offered_courses.findMany({
      where: {
        offering_id:
          offeringId,
      },

      orderBy: {
        id: "desc",
      },

      select: {
        id: true,
        master_course_id: true,

        offered_course_batches: {
          select: {
            batch_id: true,
          },
        },
      },
    });

  const seen =
    new Set<string>();

  const toDelete:
    number[] = [];

  for (const row of rows) {
    const batchIds =
      row.offered_course_batches
        .map(
          (batch) =>
            batch.batch_id
        )
        .sort(
          (a, b) =>
            a - b
        );

    if (
      batchIds.length ===
      0
    ) {
      const key =
        `${row.master_course_id}__NO_BATCH`;

      if (
        seen.has(key)
      ) {
        toDelete.push(
          row.id
        );
      } else {
        seen.add(key);
      }

      continue;
    }

    let shouldDelete =
      false;

    for (
      const batchId
      of batchIds
    ) {
      const key =
        `${row.master_course_id}__${batchId}`;

      if (
        seen.has(key)
      ) {
        shouldDelete =
          true;

        break;
      }
    }

    if (shouldDelete) {
      toDelete.push(
        row.id
      );

      continue;
    }

    for (
      const batchId
      of batchIds
    ) {
      const key =
        `${row.master_course_id}__${batchId}`;

      seen.add(key);
    }
  }

  if (
    toDelete.length ===
    0
  ) {
    return 0;
  }

  await prisma.$transaction(
    async (tx) => {
      for (
        const offeredCourseId
        of toDelete
      ) {
        await deleteOfferedCourseCascade(
          tx,
          offeredCourseId
        );
      }
    }
  );

  return toDelete.length;
}

export async function POST(
  req: NextRequest
) {
  const guard =
    await requireCoordinatorOrAdminApi();

  if (
    guard instanceof Response
  ) {
    return guard;
  }

  try {
    const body =
      await req.json();

    const programCode =
      String(
        body.programCode || ""
      )
        .trim()
        .toUpperCase();

    const requestedTermName =
      String(
        body.termName || ""
      )
        .trim()
        .toUpperCase();

    if (!programCode) {
      clearReportingCacheWithLog(
        "offering/reporting data changed"
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "programCode is required.",
        },
        {
          status: 400,
        }
      );
    }

    const resolved =
      await getProgramCandidates(
        programCode
      );

    if (
      resolved.candidates.length ===
      0
    ) {
      clearReportingCacheWithLog(
        "offering/reporting data changed"
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No program candidate could be resolved.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Canonical program now has the highest priority.
     */
    const sortedCandidates =
      [...resolved.candidates].sort(
        (a, b) =>
          sourcePriority(
            a.source
          ) -
          sourcePriority(
            b.source
          )
      );

    const selectedProgram =
      sortedCandidates[0];

    const term =
      await resolveAcademicTermContext({
        termName:
          requestedTermName ||
          undefined,
      });

    const preparedByUserId =
      await resolvePreparedByUserId();

    /*
     * Reuse only a draft belonging to the resolved canonical
     * program and current academic term.
     */
    const existingDraft =
      await prisma.offerings.findFirst({
        where: {
          program_id:
            selectedProgram.id,

          academic_term_id:
            term.id,

          status:
            "DRAFT",
        },

        orderBy: {
          id: "desc",
        },

        select: {
          id: true,
        },
      });

    if (existingDraft) {
      const removedCount =
        await deduplicateDraftByLatest(
          existingDraft.id
        );

      clearReportingCacheWithLog(
        "offering/reporting data changed"
      );

      return NextResponse.json({
        ok: true,

        draftId:
          existingDraft.id,

        reused:
          true,

        deduplicated:
          removedCount > 0,

        removedDuplicateCount:
          removedCount,

        requestedProgramCode:
          resolved.requestedProgramCode,

        selectedProgram: {
          id:
            selectedProgram.id,

          shortName:
            selectedProgram.short_name,

          name:
            selectedProgram.name,

          source:
            selectedProgram.source,
        },
      });
    }

    /*
     * Create the offering under the canonical academic program.
     */
    const draft =
      await prisma.offerings.create({
        data: {
          status:
            "DRAFT",

          academic_terms: {
            connect: {
              id:
                term.id,
            },
          },

          programs: {
            connect: {
              id:
                selectedProgram.id,
            },
          },

          users: {
            connect: {
              id:
                preparedByUserId,
            },
          },
        },

        select: {
          id: true,
        },
      });

    clearReportingCacheWithLog(
      "offering/reporting data changed"
    );

    return NextResponse.json({
      ok: true,

      draftId:
        draft.id,

      reused:
        false,

      deduplicated:
        false,

      removedDuplicateCount:
        0,

      requestedProgramCode:
        resolved.requestedProgramCode,

      selectedProgram: {
        id:
          selectedProgram.id,

        shortName:
          selectedProgram.short_name,

        name:
          selectedProgram.name,

        source:
          selectedProgram.source,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create draft offering.";

    const status =
      isAcademicTermContextError(
        error
      )
        ? error.code ===
          "ACADEMIC_TERM_NOT_FOUND"
          ? 404
          : 409
        : 500;

    clearReportingCacheWithLog(
      "offering/reporting data changed"
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          message,
      },
      {
        status,
      }
    );
  }
}
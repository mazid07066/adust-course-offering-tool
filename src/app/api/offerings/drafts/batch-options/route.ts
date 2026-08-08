import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  requireCoordinatorOrAdminApi,
} from "@/lib/auth-guard";

import {
  getCatalogProgramByCode,
} from "@/lib/academic-catalog";

import {
  resolveCanonicalProgram,
} from "@/lib/canonical-program";

import {
  resolveAcademicTermContext,
} from "@/lib/academic-term-context";

import {
  getExcludedBatchIdsForTerm,
} from "@/lib/batch-term-offering-status";

type ProgramCandidateSource =
  | "CANONICAL_PROGRAM"
  | "EXACT_PROGRAM_CODE"
  | "CURRICULUM_RELATED_PROGRAM";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source: ProgramCandidateSource;
};

function normalizeUpper(
  value: unknown
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}

function uniqueById<
  T extends {
    id: number;
  },
>(
  rows: T[]
): T[] {
  const seen =
    new Set<number>();

  const output: T[] =
    [];

  for (
    const row of rows
  ) {
    if (
      seen.has(
        row.id
      )
    ) {
      continue;
    }

    seen.add(
      row.id
    );

    output.push(
      row
    );
  }

  return output;
}

function sourcePriority(
  source:
    ProgramCandidateSource
) {
  /*
   * Canonical program must win whenever
   * the same batch code exists under both
   * canonical and historical program rows.
   */
  if (
    source ===
    "CANONICAL_PROGRAM"
  ) {
    return 1;
  }

  if (
    source ===
    "EXACT_PROGRAM_CODE"
  ) {
    return 2;
  }

  return 3;
}

async function getProgramCandidates(
  programCode: string
): Promise<
  ProgramCandidate[]
> {
  const normalizedProgramCode =
    normalizeUpper(
      programCode
    );

  if (
    !normalizedProgramCode
  ) {
    throw new Error(
      "programCode is required."
    );
  }

  const staticCatalog =
    getCatalogProgramByCode(
      normalizedProgramCode
    );

  if (
    !staticCatalog
  ) {
    throw new Error(
      "Invalid academic identity programCode."
    );
  }

  const catalogEntry =
    await prisma
      .academic_catalog_entries
      .findUnique({
        where: {
          program_code:
            normalizedProgramCode,
        },

        select: {
          department_code:
            true,

          department_name:
            true,

          program_title:
            true,

          study_shift:
            true,

          curriculum_key:
            true,
        },
      });

  const candidates:
    ProgramCandidate[] =
      [];

  /*
   * Resolve canonical program first.
   * This is the authoritative batch
   * identity used by the current
   * semester workflow.
   */
  const canonicalProgram =
    await resolveCanonicalProgram({
      department_code:
        catalogEntry
          ?.department_code ||
        staticCatalog
          .departmentCode,

      department_name:
        catalogEntry
          ?.department_name ||
        staticCatalog
          .departmentName,

      program_code:
        normalizedProgramCode,

      program_title:
        catalogEntry
          ?.program_title ||
        staticCatalog
          .programTitle,

      study_shift:
        catalogEntry
          ?.study_shift ||
        staticCatalog
          .studyShift,
    });

  candidates.push({
    id:
      canonicalProgram.id,

    short_name:
      canonicalProgram
        .short_name,

    name:
      canonicalProgram.name,

    source:
      "CANONICAL_PROGRAM",
  });

  /*
   * Historical exact program rows may
   * still exist. They remain query
   * candidates so older batch records
   * can be found, but they must not
   * override a canonical batch having
   * the same batch code.
   */
  const exactProgram =
    await prisma.programs.findFirst({
      where: {
        short_name:
          normalizedProgramCode,
      },

      select: {
        id: true,
        short_name:
          true,
        name: true,
      },
    });

  if (
    exactProgram &&
    !candidates.some(
      (candidate) =>
        candidate.id ===
        exactProgram.id
    )
  ) {
    candidates.push({
      ...exactProgram,

      source:
        "EXACT_PROGRAM_CODE",
    });
  }

  const curriculumKey =
    catalogEntry
      ?.curriculum_key ||
    null;

  if (
    curriculumKey
  ) {
    const relatedCatalogEntries =
      await prisma
        .academic_catalog_entries
        .findMany({
          where: {
            curriculum_key:
              curriculumKey,

            is_active:
              true,
          },

          select: {
            program_code:
              true,
          },
        });

    const relatedProgramCodes =
      relatedCatalogEntries
        .map(
          (item) =>
            normalizeUpper(
              item.program_code
            )
        )
        .filter(
          Boolean
        );

    if (
      relatedProgramCodes.length >
      0
    ) {
      const relatedPrograms =
        await prisma.programs.findMany({
          where: {
            short_name: {
              in:
                relatedProgramCodes,
            },
          },

          select: {
            id: true,
            short_name:
              true,
            name: true,
          },
        });

      for (
        const relatedProgram of
        relatedPrograms
      ) {
        if (
          candidates.some(
            (candidate) =>
              candidate.id ===
              relatedProgram.id
          )
        ) {
          continue;
        }

        candidates.push({
          ...relatedProgram,

          source:
            "CURRICULUM_RELATED_PROGRAM",
        });
      }
    }
  }

  return uniqueById(
    candidates
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const guard =
      await requireCoordinatorOrAdminApi();

    if (
      guard instanceof Response
    ) {
      return guard;
    }

    const {
      searchParams,
    } = new URL(
      request.url
    );

    const programCode =
      normalizeUpper(
        searchParams.get(
          "programCode"
        )
      );

    const requestedTermName =
      String(
        searchParams.get(
          "termName"
        ) || ""
      ).trim();

    if (
      !programCode
    ) {
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

    const candidates =
      await getProgramCandidates(
        programCode
      );

    const term =
      await resolveAcademicTermContext({
        termName:
          requestedTermName ||
          undefined,
      });

    const candidateIds =
      candidates.map(
        (candidate) =>
          candidate.id
      );

    const candidateSourceById =
      new Map<
        number,
        ProgramCandidateSource
      >(
        candidates.map(
          (candidate) => [
            candidate.id,
            candidate.source,
          ]
        )
      );

    const rows =
      await prisma.batches.findMany({
        where: {
          program_id: {
            in:
              candidateIds,
          },

          is_active:
            true,
        },

        select: {
          id: true,

          batch_code:
            true,

          admission_term:
            true,

          program_id:
            true,

          programs: {
            select: {
              short_name:
                true,

              name:
                true,
            },
          },
        },

        orderBy: [
          {
            batch_code:
              "asc",
          },

          {
            id:
              "asc",
          },
        ],
      });

    /*
     * Multiple historical program rows
     * may contain the same logical batch
     * code.
     *
     * Keep only one row per code,
     * preferring the canonical program.
     */
    const bestBatchByCode =
      new Map<
        string,
        (typeof rows)[number]
      >();

    for (
      const row of rows
    ) {
      const batchCode =
        normalizeUpper(
          row.batch_code
        );

      if (
        !batchCode
      ) {
        continue;
      }

      const existing =
        bestBatchByCode.get(
          batchCode
        );

      if (
        !existing
      ) {
        bestBatchByCode.set(
          batchCode,
          row
        );

        continue;
      }

      const rowSource =
        candidateSourceById.get(
          row.program_id
        ) ||
        "CURRICULUM_RELATED_PROGRAM";

      const existingSource =
        candidateSourceById.get(
          existing.program_id
        ) ||
        "CURRICULUM_RELATED_PROGRAM";

      const rowPriority =
        sourcePriority(
          rowSource
        );

      const existingPriority =
        sourcePriority(
          existingSource
        );

      if (
        rowPriority <
        existingPriority
      ) {
        bestBatchByCode.set(
          batchCode,
          row
        );

        continue;
      }

      /*
       * Deterministic fallback when
       * both candidates have the same
       * source priority.
       */
      if (
        rowPriority ===
          existingPriority &&
        row.id <
          existing.id
      ) {
        bestBatchByCode.set(
          batchCode,
          row
        );
      }
    }

    const deduplicatedRows =
      Array.from(
        bestBatchByCode.values()
      ).sort(
        (
          left,
          right
        ) =>
          String(
            left.batch_code
          ).localeCompare(
            String(
              right.batch_code
            ),
            undefined,
            {
              numeric: true,
            }
          )
      );

    /*
     * Semester exclusions are checked
     * only against the authoritative
     * deduplicated batch rows.
     */
    const excludedBatchIds =
      await getExcludedBatchIdsForTerm(
        term.id,
        deduplicatedRows.map(
          (row) =>
            row.id
        )
      );

    const eligibleRows =
      deduplicatedRows.filter(
        (row) =>
          !excludedBatchIds.has(
            row.id
          )
      );

    return NextResponse.json({
      ok: true,

      academicTerm: {
        id:
          term.id,

        name:
          term.name,
      },

      batches:
        eligibleRows.map(
          (row) => ({
            id:
              row.id,

            batch_code:
              row.batch_code,

            admission_term:
              row.admission_term,

            program_code:
              row.programs
                .short_name,

            program_name:
              row.programs
                .name,
          })
        ),

      excludedBatchIds:
        Array.from(
          excludedBatchIds
        ).sort(
          (
            left,
            right
          ) =>
            left -
            right
        ),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load batch options.";

    return NextResponse.json(
      {
        ok: false,

        error:
          message,
      },
      {
        status: 500,
      }
    );
  }
}
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireCoordinatorOrAdminApi,
} from "@/lib/auth-guard";

import {
  resolveAcademicTermContext,
} from "@/lib/academic-term-context";

import {
  getBatchTermOfferingStatuses,
  isBatchTermOfferingStatus,
  upsertBatchTermOfferingStatus,
} from "@/lib/batch-term-offering-status";

import { prisma } from "@/lib/prisma";

function normalizeText(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

export async function GET(
  request: NextRequest
) {
  const guard =
    await requireCoordinatorOrAdminApi();

  if (
    guard instanceof Response
  ) {
    return guard;
  }

  try {
    const {
      searchParams,
    } = new URL(
      request.url
    );

    const requestedTerm =
      normalizeText(
        searchParams.get(
          "termName"
        )
      );

    const term =
      await resolveAcademicTermContext({
        termName:
          requestedTerm ||
          undefined,
      });

    const batches =
      await prisma.batches.findMany({
        where: {
          is_active: true,
        },

        select: {
          id: true,
          batch_code: true,
          admission_term: true,
          program_id: true,

          programs: {
            select: {
              id: true,
              name: true,
              short_name: true,

              departments: {
                select: {
                  short_name: true,
                  name: true,
                },
              },
            },
          },
        },

        orderBy: [
          {
            program_id:
              "asc",
          },
          {
            batch_code:
              "asc",
          },
        ],
      });

    const statuses =
      await getBatchTermOfferingStatuses(
        term.id,
        batches.map(
          (batch) =>
            batch.id
        )
      );

    const statusMap =
      new Map(
        statuses.map(
          (row) => [
            row.batch_id,
            row,
          ]
        )
      );

    return NextResponse.json({
      ok: true,

      term: {
        id:
          term.id,

        name:
          term.name,

        isCurrent:
          term.is_current,
      },

      batches:
        batches.map(
          (batch) => {
            const decision =
              statusMap.get(
                batch.id
              );

            return {
              id:
                batch.id,

              batchCode:
                batch.batch_code,

              admissionTerm:
                batch.admission_term,

              programId:
                batch.program_id,

              programCode:
                batch.programs
                  .short_name,

              programName:
                batch.programs
                  .name,

              departmentCode:
                batch.programs
                  .departments
                  .short_name,

              departmentName:
                batch.programs
                  .departments
                  .name,

              status:
                decision?.status ||
                "ACTIVE_FOR_OFFERING",

              reason:
                decision?.reason ||
                null,

              updatedAt:
                decision?.updated_at ||
                null,
            };
          }
        ),
    });
  } catch (error) {
    console.error(
      "Batch offering status GET failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to load batch offering statuses.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
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
      await request.json();

    const batchId =
      Number(
        body?.batchId
      );

    const status =
      normalizeText(
        body?.status
      ).toUpperCase();

    const reason =
      normalizeText(
        body?.reason
      );

    const requestedTerm =
      normalizeText(
        body?.termName
      );

    if (
      !Number.isInteger(
        batchId
      ) ||
      batchId <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid batchId is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isBatchTermOfferingStatus(
        status
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid semester batch offering status.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      status ===
        "NO_OFFERING_OTHER" &&
      !reason
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A reason is required for NO_OFFERING_OTHER.",
        },
        {
          status: 400,
        }
      );
    }

    const term =
      await resolveAcademicTermContext({
        termName:
          requestedTerm ||
          undefined,
      });

    const batch =
      await prisma.batches.findUnique({
        where: {
          id:
            batchId,
        },

        select: {
          id: true,
          batch_code: true,
          program_id: true,
          is_active: true,

          programs: {
            select: {
              short_name:
                true,

              name:
                true,
            },
          },
        },
      });

    if (!batch) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Batch was not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      batch.is_active ===
      false
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "Inactive batches cannot receive a semester offering status.",
        },
        {
          status: 409,
        }
      );
    }

    const saved =
      await upsertBatchTermOfferingStatus({
        batchId:
          batch.id,

        academicTermId:
          term.id,

        status,

        reason:
          reason ||
          null,
      });

    return NextResponse.json({
      ok: true,

      message:
        status.startsWith(
          "NO_OFFERING_"
        )
          ? `${batch.programs.short_name} batch ${batch.batch_code} is excluded from offering preparation for ${term.name}.`
          : `${batch.programs.short_name} batch ${batch.batch_code} is active for offering preparation for ${term.name}.`,

      batch: {
        id:
          batch.id,

        batchCode:
          batch.batch_code,

        programId:
          batch.program_id,

        programCode:
          batch.programs
            .short_name,

        programName:
          batch.programs
            .name,
      },

      term: {
        id:
          term.id,

        name:
          term.name,
      },

      decision:
        saved,
    });
  } catch (error) {
    console.error(
      "Batch offering status POST failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to save batch offering status.",
      },
      {
        status: 500,
      }
    );
  }
}
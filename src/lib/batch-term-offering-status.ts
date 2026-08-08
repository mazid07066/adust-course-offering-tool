import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const BATCH_TERM_OFFERING_STATUSES = [
  "ACTIVE_FOR_OFFERING",
  "NO_OFFERING_PASSING_OUT",
  "NO_OFFERING_NO_STUDENTS",
  "NO_OFFERING_PROGRAM_DECISION",
  "NO_OFFERING_OTHER",
] as const;

export type BatchTermOfferingStatus =
  (typeof BATCH_TERM_OFFERING_STATUSES)[number];

export type BatchTermOfferingStatusRow = {
  id: number;
  batch_id: number;
  academic_term_id: number;
  status: BatchTermOfferingStatus;
  reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export function isBatchTermOfferingStatus(
  value: unknown
): value is BatchTermOfferingStatus {
  return BATCH_TERM_OFFERING_STATUSES.includes(
    String(value || "").trim().toUpperCase() as BatchTermOfferingStatus
  );
}

export function isNoOfferingStatus(
  status: string | null | undefined
) {
  return String(status || "")
    .trim()
    .toUpperCase()
    .startsWith("NO_OFFERING_");
}

export async function getBatchTermOfferingStatuses(
  academicTermId: number,
  batchIds?: number[]
): Promise<BatchTermOfferingStatusRow[]> {
  if (
    batchIds &&
    batchIds.length === 0
  ) {
    return [];
  }

  if (
    batchIds &&
    batchIds.length > 0
  ) {
    return prisma.$queryRaw<
      BatchTermOfferingStatusRow[]
    >(Prisma.sql`
      SELECT
        id,
        batch_id,
        academic_term_id,
        status,
        reason,
        created_at,
        updated_at
      FROM public.batch_term_offering_statuses
      WHERE academic_term_id = ${academicTermId}
        AND batch_id IN (${Prisma.join(batchIds)})
      ORDER BY batch_id ASC
    `);
  }

  return prisma.$queryRaw<
    BatchTermOfferingStatusRow[]
  >(Prisma.sql`
    SELECT
      id,
      batch_id,
      academic_term_id,
      status,
      reason,
      created_at,
      updated_at
    FROM public.batch_term_offering_statuses
    WHERE academic_term_id = ${academicTermId}
    ORDER BY batch_id ASC
  `);
}

export async function getExcludedBatchIdsForTerm(
  academicTermId: number,
  batchIds?: number[]
): Promise<Set<number>> {
  const rows =
    await getBatchTermOfferingStatuses(
      academicTermId,
      batchIds
    );

  return new Set(
    rows
      .filter((row) =>
        isNoOfferingStatus(
          row.status
        )
      )
      .map((row) =>
        Number(row.batch_id)
      )
  );
}

export async function upsertBatchTermOfferingStatus(args: {
  batchId: number;
  academicTermId: number;
  status: BatchTermOfferingStatus;
  reason?: string | null;
}) {
  const reason =
    String(
      args.reason || ""
    ).trim() || null;

  const rows =
    await prisma.$queryRaw<
      BatchTermOfferingStatusRow[]
    >(Prisma.sql`
      INSERT INTO public.batch_term_offering_statuses (
        batch_id,
        academic_term_id,
        status,
        reason,
        created_at,
        updated_at
      )
      VALUES (
        ${args.batchId},
        ${args.academicTermId},
        ${args.status},
        ${reason},
        NOW(),
        NOW()
      )
      ON CONFLICT (
        batch_id,
        academic_term_id
      )
      DO UPDATE SET
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        updated_at = NOW()
      RETURNING
        id,
        batch_id,
        academic_term_id,
        status,
        reason,
        created_at,
        updated_at
    `);

  if (!rows[0]) {
    throw new Error(
      "Batch term offering status was not saved."
    );
  }

  return rows[0];
}
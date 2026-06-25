import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ALLOWED_REVIEW_STATUSES = [
  "PENDING_REVIEW",
  "DONE",
  "REQUIRES_UPDATE",
  "NEEDS_MODIFICATION",
];

function parseEvidenceId(value: string) {
  const evidenceId = Number(value);

  if (!Number.isInteger(evidenceId) || evidenceId <= 0) {
    throw new Error("Invalid evidence id.");
  }

  return evidenceId;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const evidenceId = parseEvidenceId(id);

    const body = await req.json();

    const reviewStatus = String(body.review_status || "")
      .trim()
      .toUpperCase();

    const reviewerFeedback = String(body.reviewer_feedback || "").trim();

    if (!ALLOWED_REVIEW_STATUSES.includes(reviewStatus)) {
      return NextResponse.json(
        {
          error: `Invalid review status. Allowed: ${ALLOWED_REVIEW_STATUSES.join(
            ", "
          )}.`,
        },
        { status: 400 }
      );
    }

    const existingRows = await prisma.$queryRaw<
      Array<{ id: number; task_id: number }>
    >`
      SELECT id, task_id
      FROM baete_task_evidence
      WHERE id = ${evidenceId}
      LIMIT 1;
    `;

    const existing = existingRows[0];

    if (!existing) {
      return NextResponse.json(
        { error: "Evidence file not found." },
        { status: 404 }
      );
    }

    await prisma.$executeRaw`
      UPDATE baete_task_evidence
      SET
        review_status = ${reviewStatus},
        reviewer_feedback = ${reviewerFeedback || null},
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${evidenceId};
    `;

    if (reviewStatus === "DONE") {
      await prisma.$executeRaw`
        UPDATE baete_tasks
        SET
          status = 'VERIFIED',
          is_completed = TRUE,
          completed_at = COALESCE(completed_at, NOW()),
          updated_at = NOW()
        WHERE id = ${existing.task_id};
      `;
    }

    if (
      reviewStatus === "REQUIRES_UPDATE" ||
      reviewStatus === "NEEDS_MODIFICATION"
    ) {
      await prisma.$executeRaw`
        UPDATE baete_tasks
        SET
          status = 'NEEDS_REVISION',
          is_completed = FALSE,
          completed_at = NULL,
          updated_at = NOW()
        WHERE id = ${existing.task_id};
      `;
    }

    return NextResponse.json({
      success: true,
      message: "Evidence review updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update evidence review.",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ALLOWED_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "SUBMITTED",
  "NEEDS_REVISION",
  "COMPLETED",
  "VERIFIED",
];

function parseOptionalPositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Assigned committee id must be a positive integer.");
  }

  return parsed;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const taskId = Number(id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return NextResponse.json(
        { error: "Invalid task id." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const existingRows = await prisma.$queryRaw<
      Array<{
        id: number;
        assigned_committee_id: number | null;
        status: string;
        is_completed: boolean;
        completion_note: string | null;
      }>
    >`
      SELECT
        id,
        assigned_committee_id,
        status,
        is_completed,
        completion_note
      FROM baete_tasks
      WHERE id = ${taskId}
      LIMIT 1;
    `;

    const existing = existingRows[0];

    if (!existing) {
      return NextResponse.json(
        { error: "Task not found." },
        { status: 404 }
      );
    }

    const assignedCommitteeId =
      "assigned_committee_id" in body
        ? parseOptionalPositiveInteger(body.assigned_committee_id)
        : existing.assigned_committee_id;

    const nextStatus =
      typeof body.status === "string"
        ? body.status.trim().toUpperCase()
        : existing.status;

    if (!ALLOWED_STATUSES.includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const nextCompleted =
      typeof body.is_completed === "boolean"
        ? body.is_completed
        : existing.is_completed;

    const completionNote =
      typeof body.completion_note === "string"
        ? body.completion_note.trim() || null
        : existing.completion_note;

    const completedAt =
      nextCompleted && !existing.is_completed
        ? new Date()
        : !nextCompleted
          ? null
          : undefined;

    if (assignedCommitteeId) {
      const committeeRows = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id
        FROM baete_committees
        WHERE id = ${assignedCommitteeId}
          AND is_active = TRUE
        LIMIT 1;
      `;

      if (!committeeRows[0]) {
        return NextResponse.json(
          { error: "Selected committee was not found or is inactive." },
          { status: 400 }
        );
      }
    }

    if (completedAt === undefined) {
      await prisma.$executeRaw`
        UPDATE baete_tasks
        SET
          assigned_committee_id = ${assignedCommitteeId},
          status = ${nextStatus},
          is_completed = ${nextCompleted},
          completion_note = ${completionNote},
          updated_at = NOW()
        WHERE id = ${taskId};
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE baete_tasks
        SET
          assigned_committee_id = ${assignedCommitteeId},
          status = ${nextStatus},
          is_completed = ${nextCompleted},
          completed_at = ${completedAt},
          completion_note = ${completionNote},
          updated_at = NOW()
        WHERE id = ${taskId};
      `;
    }

    await prisma.$executeRaw`
      INSERT INTO baete_task_updates (
        task_id,
        old_status,
        new_status,
        old_completed,
        new_completed,
        note,
        created_at
      )
      VALUES (
        ${taskId},
        ${existing.status},
        ${nextStatus},
        ${existing.is_completed},
        ${nextCompleted},
        ${completionNote},
        NOW()
      );
    `;

    return NextResponse.json({
      success: true,
      message: "Task updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update BAETE task.",
      },
      { status: 500 }
    );
  }
}

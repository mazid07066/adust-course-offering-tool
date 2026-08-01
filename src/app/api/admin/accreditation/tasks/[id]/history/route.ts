import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function parseTaskId(value: string) {
  const taskId = Number(value);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error("Invalid task id.");
  }

  return taskId;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const taskId = parseTaskId(id);

    const taskRows = await prisma.$queryRaw<
      Array<{
        id: number;
        title: string;
        status: string;
        is_completed: boolean;
        updated_at: Date;
      }>
    >`
      SELECT id, title, status, is_completed, updated_at
      FROM baete_tasks
      WHERE id = ${taskId}
      LIMIT 1;
    `;

    const task = taskRows[0];

    if (!task) {
      return NextResponse.json(
        { error: "Task not found." },
        { status: 404 }
      );
    }

    const updates = await prisma.$queryRaw<
      Array<{
        id: number;
        task_id: number;
        old_status: string | null;
        new_status: string | null;
        old_completed: boolean | null;
        new_completed: boolean | null;
        note: string | null;
        updated_by_user_id: number | null;
        updated_by_label: string | null;
        created_at: Date;
      }>
    >`
      SELECT
        tu.id,
        tu.task_id,
        tu.old_status,
        tu.new_status,
        tu.old_completed,
        tu.new_completed,
        tu.note,
        tu.updated_by_user_id,
        COALESCE(
          to_jsonb(u)->>'name',
          to_jsonb(u)->>'full_name',
          to_jsonb(u)->>'display_name',
          to_jsonb(u)->>'email',
          CASE WHEN u.id IS NULL THEN NULL ELSE 'User ' || u.id::text END
        ) AS updated_by_label,
        tu.created_at
      FROM baete_task_updates tu
      LEFT JOIN users u ON u.id = tu.updated_by_user_id
      WHERE tu.task_id = ${taskId}
      ORDER BY tu.created_at DESC, tu.id DESC;
    `;

    const evidence = await prisma.$queryRaw<
      Array<{
        id: number;
        original_file_name: string;
        evidence_note: string | null;
        review_status: string;
        reviewer_feedback: string | null;
        reviewed_by_user_id: number | null;
        reviewed_by_label: string | null;
        reviewed_at: Date | null;
        created_at: Date;
      }>
    >`
      SELECT
        e.id,
        e.original_file_name,
        e.evidence_note,
        e.review_status,
        e.reviewer_feedback,
        e.reviewed_by_user_id,
        COALESCE(
          to_jsonb(u)->>'name',
          to_jsonb(u)->>'full_name',
          to_jsonb(u)->>'display_name',
          to_jsonb(u)->>'email',
          CASE WHEN u.id IS NULL THEN NULL ELSE 'User ' || u.id::text END
        ) AS reviewed_by_label,
        e.reviewed_at,
        e.created_at
      FROM baete_task_evidence e
      LEFT JOIN users u ON u.id = e.reviewed_by_user_id
      WHERE e.task_id = ${taskId}
      ORDER BY e.created_at DESC, e.id DESC;
    `;

    return NextResponse.json({
      success: true,
      task,
      updates,
      evidence,
    });
  } catch (error) {
    console.error("BAETE task history error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load task history.",
      },
      { status: 500 }
    );
  }
}
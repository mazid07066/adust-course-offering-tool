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

const ALLOWED_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

function parseId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid task id.");
  }

  return id;
}

function parseOptionalPositiveInteger(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function parseOptionalNonNegativeInteger(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  return parsed;
}

function normalizeStatus(value: unknown, fallback: string) {
  const status =
    typeof value === "string" ? value.trim().toUpperCase() : fallback;

  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}.`);
  }

  return status;
}

function normalizePriority(value: unknown, fallback: string) {
  const priority =
    typeof value === "string" ? value.trim().toUpperCase() : fallback;

  if (!ALLOWED_PRIORITIES.includes(priority)) {
    throw new Error(
      `Invalid priority. Allowed: ${ALLOWED_PRIORITIES.join(", ")}.`
    );
  }

  return priority;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const taskId = parseId(id);

    const body = await req.json();

    const existingRows = await prisma.$queryRaw<
      Array<{
        id: number;
        title: string;
        description: string | null;
        deliverable: string | null;
        evidence_format: string | null;
        evidence_reference: string | null;
        priority: string;
        status: string;
        is_critical: boolean;
        requires_checkbox: boolean;
        is_completed: boolean;
        completion_note: string | null;
        assigned_committee_id: number | null;
        assigned_user_id: number | null;
        start_month: number | null;
        end_month: number | null;
        start_week: number | null;
        end_week: number | null;
        display_order: number;
      }>
    >`
      SELECT
        id,
        title,
        description,
        deliverable,
        evidence_format,
        evidence_reference,
        priority,
        status,
        is_critical,
        requires_checkbox,
        is_completed,
        completion_note,
        assigned_committee_id,
        assigned_user_id,
        start_month,
        end_month,
        start_week,
        end_week,
        display_order
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

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : existing.title;

    const description =
      "description" in body
        ? String(body.description || "").trim() || null
        : existing.description;

    const deliverable =
      "deliverable" in body
        ? String(body.deliverable || "").trim() || null
        : existing.deliverable;

    const evidenceFormat =
      "evidence_format" in body
        ? String(body.evidence_format || "").trim() || null
        : existing.evidence_format;

    const evidenceReference =
      "evidence_reference" in body
        ? String(body.evidence_reference || "").trim() || null
        : existing.evidence_reference;

    const priority = normalizePriority(body.priority, existing.priority);
    const status = normalizeStatus(body.status, existing.status);

    const isCompleted =
      typeof body.is_completed === "boolean"
        ? body.is_completed
        : existing.is_completed;

    const isCritical =
      typeof body.is_critical === "boolean"
        ? body.is_critical
        : priority === "CRITICAL"
          ? true
          : existing.is_critical;

    const requiresCheckbox =
      typeof body.requires_checkbox === "boolean"
        ? body.requires_checkbox
        : existing.requires_checkbox;

    const completionNote =
      "completion_note" in body
        ? String(body.completion_note || "").trim() || null
        : existing.completion_note;

    const assignedCommitteeId =
      "assigned_committee_id" in body
        ? parseOptionalPositiveInteger(
            body.assigned_committee_id,
            "assigned_committee_id"
          )
        : existing.assigned_committee_id;

    const assignedUserId =
      "assigned_user_id" in body
        ? parseOptionalPositiveInteger(body.assigned_user_id, "assigned_user_id")
        : existing.assigned_user_id;

    const startMonth =
      "start_month" in body
        ? parseOptionalPositiveInteger(body.start_month, "start_month")
        : existing.start_month;

    const endMonth =
      "end_month" in body
        ? parseOptionalPositiveInteger(body.end_month, "end_month")
        : existing.end_month;

    const startWeek =
      "start_week" in body
        ? parseOptionalPositiveInteger(body.start_week, "start_week")
        : existing.start_week;

    const endWeek =
      "end_week" in body
        ? parseOptionalPositiveInteger(body.end_week, "end_week")
        : existing.end_week;

    const displayOrder =
      "display_order" in body
        ? parseOptionalNonNegativeInteger(body.display_order, "display_order") ??
          existing.display_order
        : existing.display_order;

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

    const completedAtValue =
      isCompleted && !existing.is_completed
        ? new Date()
        : !isCompleted
          ? null
          : undefined;

    if (completedAtValue === undefined) {
      await prisma.$executeRaw`
        UPDATE baete_tasks
        SET
          title = ${title},
          description = ${description},
          deliverable = ${deliverable},
          evidence_format = ${evidenceFormat},
          evidence_reference = ${evidenceReference},
          priority = ${priority},
          status = ${status},
          is_critical = ${isCritical},
          requires_checkbox = ${requiresCheckbox},
          is_completed = ${isCompleted},
          completion_note = ${completionNote},
          assigned_committee_id = ${assignedCommitteeId},
          assigned_user_id = ${assignedUserId},
          start_month = ${startMonth},
          end_month = ${endMonth},
          start_week = ${startWeek},
          end_week = ${endWeek},
          display_order = ${displayOrder},
          updated_at = NOW()
        WHERE id = ${taskId};
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE baete_tasks
        SET
          title = ${title},
          description = ${description},
          deliverable = ${deliverable},
          evidence_format = ${evidenceFormat},
          evidence_reference = ${evidenceReference},
          priority = ${priority},
          status = ${status},
          is_critical = ${isCritical},
          requires_checkbox = ${requiresCheckbox},
          is_completed = ${isCompleted},
          completed_at = ${completedAtValue},
          completion_note = ${completionNote},
          assigned_committee_id = ${assignedCommitteeId},
          assigned_user_id = ${assignedUserId},
          start_month = ${startMonth},
          end_month = ${endMonth},
          start_week = ${startWeek},
          end_week = ${endWeek},
          display_order = ${displayOrder},
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
        ${status},
        ${existing.is_completed},
        ${isCompleted},
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

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const taskId = parseId(id);

    await prisma.$executeRaw`
      UPDATE baete_tasks
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = ${taskId};
    `;

    return NextResponse.json({
      success: true,
      message: "Task archived successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to archive BAETE task.",
      },
      { status: 500 }
    );
  }
}
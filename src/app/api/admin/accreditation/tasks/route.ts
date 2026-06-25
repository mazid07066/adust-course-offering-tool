import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireBaeteManagerApi,
  requireBaeteWorkspaceApi,
} from "@/lib/baete-permissions";

type TaskRow = {
  id: number;
  task_group_id: number;
  group_code: string;
  group_title: string;
  group_description: string | null;
  group_display_order: number;
  module_code: string;
  module_title: string;
  module_description: string | null;
  task_code: string | null;
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
  completed_at: Date | null;
  completion_note: string | null;
  assigned_committee_id: number | null;
  assigned_committee_code: string | null;
  assigned_committee_name: string | null;
  assigned_user_id: number | null;
  assigned_user_label: string | null;
  start_month: number | null;
  end_month: number | null;
  start_week: number | null;
  end_week: number | null;
  due_date: Date | null;
  display_order: number;
};

const ALLOWED_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

function parseOptionalPositiveInteger(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function normalizePriority(value: unknown) {
  const priority = String(value || "NORMAL").trim().toUpperCase();

  if (!ALLOWED_PRIORITIES.includes(priority)) {
    throw new Error(`Invalid priority. Allowed: ${ALLOWED_PRIORITIES.join(", ")}.`);
  }

  return priority;
}

export async function GET(req: NextRequest) {
  const permission = await requireBaeteWorkspaceApi();
  if (permission instanceof Response) return permission;

  try {
    const { searchParams } = new URL(req.url);
    const moduleCode = String(searchParams.get("moduleCode") || "")
      .trim()
      .toUpperCase();

    if (!moduleCode) {
      return NextResponse.json(
        { error: "moduleCode is required." },
        { status: 400 }
      );
    }

    const moduleRows = await prisma.$queryRaw<
      Array<{
        id: number;
        module_code: string;
        module_title: string;
        description: string | null;
      }>
    >`
      SELECT
        id,
        module_code,
        module_title,
        description
      FROM baete_workspace_modules
      WHERE module_code = ${moduleCode}
        AND is_active = TRUE
      LIMIT 1;
    `;

    const module = moduleRows[0];

    if (!module) {
      return NextResponse.json(
        { error: "BAETE workspace module not found." },
        { status: 404 }
      );
    }

    const rows = await prisma.$queryRaw<TaskRow[]>`
      SELECT
        t.id,
        t.task_group_id,
        g.group_code,
        g.group_title,
        g.description AS group_description,
        g.display_order AS group_display_order,
        m.module_code,
        m.module_title,
        m.description AS module_description,
        t.task_code,
        t.title,
        t.description,
        t.deliverable,
        t.evidence_format,
        t.evidence_reference,
        t.priority,
        t.status,
        t.is_critical,
        t.requires_checkbox,
        t.is_completed,
        t.completed_at,
        t.completion_note,
        t.assigned_committee_id,
        c.committee_code AS assigned_committee_code,
        c.committee_name AS assigned_committee_name,
        t.assigned_user_id,
        COALESCE(
          to_jsonb(u)->>'name',
          to_jsonb(u)->>'full_name',
          to_jsonb(u)->>'display_name',
          to_jsonb(u)->>'email',
          CASE WHEN u.id IS NULL THEN NULL ELSE 'User ' || u.id::text END
        ) AS assigned_user_label,
        t.start_month,
        t.end_month,
        t.start_week,
        t.end_week,
        t.due_date,
        t.display_order
      FROM baete_tasks t
      JOIN baete_task_groups g ON g.id = t.task_group_id
      JOIN baete_workspace_modules m ON m.id = g.module_id
      LEFT JOIN baete_committees c ON c.id = t.assigned_committee_id
      LEFT JOIN users u ON u.id = t.assigned_user_id
      WHERE m.module_code = ${moduleCode}
        AND m.is_active = TRUE
        AND g.is_active = TRUE
        AND t.is_active = TRUE
      ORDER BY
        g.display_order ASC,
        t.display_order ASC,
        t.id ASC;
    `;

    const groupsMap = new Map<
      number,
      {
        id: number;
        group_code: string;
        group_title: string;
        description: string | null;
        display_order: number;
        tasks: TaskRow[];
      }
    >();

    for (const row of rows) {
      if (!groupsMap.has(row.task_group_id)) {
        groupsMap.set(row.task_group_id, {
          id: row.task_group_id,
          group_code: row.group_code,
          group_title: row.group_title,
          description: row.group_description,
          display_order: row.group_display_order,
          tasks: [],
        });
      }

      groupsMap.get(row.task_group_id)?.tasks.push(row);
    }

    const committees = await prisma.$queryRaw<
      Array<{
        id: number;
        committee_code: string;
        committee_name: string;
      }>
    >`
      SELECT
        id,
        committee_code,
        committee_name
      FROM baete_committees
      WHERE is_active = TRUE
      ORDER BY display_order ASC, committee_name ASC;
    `;

    return NextResponse.json({
      success: true,
      module,
      groups: Array.from(groupsMap.values()),
      committees,
      permissions: {
        canManageWorkspace: permission.canManageWorkspace,
        canAssignTasks: permission.canAssignTasks,
        canReviewAnyEvidence: permission.canReviewAnyEvidence,
        managedCommitteeIds: permission.managedCommitteeIds,
      },
    });
  } catch (error) {
    console.error("BAETE task list error:", error);

    return NextResponse.json(
      { error: "Failed to load BAETE tasks." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const permission = await requireBaeteManagerApi("BAETE_TASK_CREATE");
  if (permission instanceof Response) return permission;

  try {
    const body = await req.json();

    const taskGroupId = parseOptionalPositiveInteger(
      body.task_group_id,
      "task_group_id"
    );

    if (!taskGroupId) {
      return NextResponse.json(
        { error: "Task group is required." },
        { status: 400 }
      );
    }

    const title = String(body.title || "").trim();

    if (!title) {
      return NextResponse.json(
        { error: "Task title is required." },
        { status: 400 }
      );
    }

    const assignedCommitteeId = parseOptionalPositiveInteger(
      body.assigned_committee_id,
      "assigned_committee_id"
    );

    const assignedUserId = parseOptionalPositiveInteger(
      body.assigned_user_id,
      "assigned_user_id"
    );

    const startMonth = parseOptionalPositiveInteger(
      body.start_month,
      "start_month"
    );
    const endMonth = parseOptionalPositiveInteger(body.end_month, "end_month");
    const startWeek = parseOptionalPositiveInteger(body.start_week, "start_week");
    const endWeek = parseOptionalPositiveInteger(body.end_week, "end_week");

    const priority = normalizePriority(body.priority);
    const isCritical = Boolean(body.is_critical || priority === "CRITICAL");
    const requiresCheckbox =
      typeof body.requires_checkbox === "boolean"
        ? body.requires_checkbox
        : true;

    const groupRows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM baete_task_groups
      WHERE id = ${taskGroupId}
        AND is_active = TRUE
      LIMIT 1;
    `;

    if (!groupRows[0]) {
      return NextResponse.json(
        { error: "Task group not found." },
        { status: 404 }
      );
    }

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
          { error: "Assigned committee not found." },
          { status: 400 }
        );
      }
    }

    if (assignedUserId) {
      const userRows = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id
        FROM users
        WHERE id = ${assignedUserId}
        LIMIT 1;
      `;

      if (!userRows[0]) {
        return NextResponse.json(
          { error: "Assigned user not found." },
          { status: 400 }
        );
      }
    }

    const orderRows = await prisma.$queryRaw<Array<{ next_order: number }>>`
      SELECT COALESCE(MAX(display_order), 0)::int + 1 AS next_order
      FROM baete_tasks
      WHERE task_group_id = ${taskGroupId};
    `;

    const nextOrder = Number(orderRows[0]?.next_order || 1);

    await prisma.$executeRaw`
      INSERT INTO baete_tasks (
        task_group_id,
        task_code,
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
        assigned_committee_id,
        assigned_user_id,
        start_month,
        end_month,
        start_week,
        end_week,
        display_order,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        ${taskGroupId},
        ${String(body.task_code || "").trim() || null},
        ${title},
        ${String(body.description || "").trim() || null},
        ${String(body.deliverable || "").trim() || null},
        ${String(body.evidence_format || "").trim() || null},
        ${String(body.evidence_reference || "").trim() || null},
        ${priority},
        'PENDING',
        ${isCritical},
        ${requiresCheckbox},
        FALSE,
        ${assignedCommitteeId},
        ${assignedUserId},
        ${startMonth},
        ${endMonth},
        ${startWeek},
        ${endWeek},
        ${nextOrder},
        TRUE,
        NOW(),
        NOW()
      );
    `;

    return NextResponse.json({
      success: true,
      message: "BAETE task created successfully.",
    });
  } catch (error) {
    console.error("BAETE task create error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create BAETE task.",
      },
      { status: 500 }
    );
  }
}

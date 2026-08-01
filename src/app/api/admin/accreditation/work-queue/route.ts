import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ALLOWED_MODES = [
  "all",
  "my",
  "committee",
  "review",
  "overdue",
  "needs_revision",
  "unassigned",
];

type QueueTask = {
  id: number;
  task_code: string | null;
  title: string;
  description: string | null;
  deliverable: string | null;
  evidence_reference: string | null;
  priority: string;
  status: string;
  is_critical: boolean;
  is_completed: boolean;
  completed_at: Date | null;
  assigned_committee_id: number | null;
  assigned_committee_code: string | null;
  assigned_committee_name: string | null;
  assigned_user_id: number | null;
  assigned_user_label: string | null;
  module_code: string;
  module_title: string;
  route_path: string | null;
  group_title: string;
  start_month: number | null;
  end_month: number | null;
  start_week: number | null;
  end_week: number | null;
  due_date: Date | null;
  pending_evidence_count: number;
  total_evidence_count: number;
};

function parseOptionalPositiveInteger(value: string | null) {
  if (!value) return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const requestedMode = String(searchParams.get("mode") || "all")
      .trim()
      .toLowerCase();

    const mode = ALLOWED_MODES.includes(requestedMode)
      ? requestedMode
      : "all";

    const userId = parseOptionalPositiveInteger(searchParams.get("userId"));
    const committeeId = parseOptionalPositiveInteger(searchParams.get("committeeId"));

    const rows = await prisma.$queryRaw<QueueTask[]>`
      SELECT
        t.id,
        t.task_code,
        t.title,
        t.description,
        t.deliverable,
        t.evidence_reference,
        t.priority,
        t.status,
        t.is_critical,
        t.is_completed,
        t.completed_at,
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
        m.module_code,
        m.module_title,
        m.route_path,
        g.group_title,
        t.start_month,
        t.end_month,
        t.start_week,
        t.end_week,
        t.due_date,
        COUNT(e.id) FILTER (WHERE e.review_status = 'PENDING_REVIEW')::int AS pending_evidence_count,
        COUNT(e.id)::int AS total_evidence_count
      FROM baete_tasks t
      JOIN baete_task_groups g ON g.id = t.task_group_id
      JOIN baete_workspace_modules m ON m.id = g.module_id
      LEFT JOIN baete_committees c ON c.id = t.assigned_committee_id
      LEFT JOIN users u ON u.id = t.assigned_user_id
      LEFT JOIN baete_task_evidence e ON e.task_id = t.id
      WHERE t.is_active = TRUE
        AND (
          ${mode} = 'all'
          OR (${mode} = 'my' AND ${userId}::int IS NOT NULL AND t.assigned_user_id = ${userId})
          OR (${mode} = 'committee' AND ${committeeId}::int IS NOT NULL AND t.assigned_committee_id = ${committeeId})
          OR (${mode} = 'review' AND t.status = 'SUBMITTED')
          OR (${mode} = 'overdue' AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.is_completed = FALSE)
          OR (${mode} = 'needs_revision' AND t.status = 'NEEDS_REVISION')
          OR (${mode} = 'unassigned' AND t.assigned_committee_id IS NULL AND t.assigned_user_id IS NULL)
        )
      GROUP BY
        t.id,
        c.committee_code,
        c.committee_name,
        u.id,
        m.module_code,
        m.module_title,
        m.route_path,
        g.group_title
      ORDER BY
        CASE WHEN t.is_critical = TRUE AND t.is_completed = FALSE THEN 0 ELSE 1 END ASC,
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END ASC,
        t.due_date ASC NULLS LAST,
        t.created_at DESC;
    `;

    const committees = await prisma.$queryRaw<
      Array<{
        id: number;
        committee_code: string;
        committee_name: string;
      }>
    >`
      SELECT id, committee_code, committee_name
      FROM baete_committees
      WHERE is_active = TRUE
      ORDER BY display_order ASC, committee_name ASC;
    `;

    const users = await prisma.$queryRaw<
      Array<{
        id: number;
        display_name: string;
        email: string | null;
        role: string | null;
      }>
    >`
      SELECT
        u.id,
        COALESCE(
          to_jsonb(u)->>'name',
          to_jsonb(u)->>'full_name',
          to_jsonb(u)->>'display_name',
          to_jsonb(u)->>'email',
          'User ' || u.id::text
        ) AS display_name,
        to_jsonb(u)->>'email' AS email,
        to_jsonb(u)->>'role' AS role
      FROM users u
      WHERE COALESCE(to_jsonb(u)->>'is_active', 'true') <> 'false'
      ORDER BY display_name ASC;
    `;

    return NextResponse.json({
      success: true,
      mode,
      tasks: rows,
      committees,
      users,
    });
  } catch (error) {
    console.error("BAETE work queue error:", error);
    return NextResponse.json(
      { error: "Failed to load BAETE work queue." },
      { status: 500 }
    );
  }
}

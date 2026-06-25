import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const summaryRows = await prisma.$queryRaw<
      Array<{
        total_tasks: number;
        completed_tasks: number;
        submitted_tasks: number;
        needs_revision_tasks: number;
        verified_tasks: number;
        overdue_tasks: number;
        critical_open_tasks: number;
        unassigned_tasks: number;
      }>
    >`
      SELECT
        COUNT(*)::int AS total_tasks,
        COUNT(*) FILTER (WHERE is_completed = TRUE)::int AS completed_tasks,
        COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int AS submitted_tasks,
        COUNT(*) FILTER (WHERE status = 'NEEDS_REVISION')::int AS needs_revision_tasks,
        COUNT(*) FILTER (WHERE status = 'VERIFIED')::int AS verified_tasks,
        COUNT(*) FILTER (
          WHERE due_date IS NOT NULL
            AND due_date < CURRENT_DATE
            AND is_completed = FALSE
        )::int AS overdue_tasks,
        COUNT(*) FILTER (
          WHERE is_critical = TRUE
            AND is_completed = FALSE
        )::int AS critical_open_tasks,
        COUNT(*) FILTER (
          WHERE assigned_committee_id IS NULL
            AND assigned_user_id IS NULL
        )::int AS unassigned_tasks
      FROM baete_tasks
      WHERE is_active = TRUE;
    `;

    const evidenceRows = await prisma.$queryRaw<
      Array<{
        total_evidence: number;
        pending_review: number;
        done_reviews: number;
        requires_update: number;
        needs_modification: number;
      }>
    >`
      SELECT
        COUNT(*)::int AS total_evidence,
        COUNT(*) FILTER (WHERE review_status = 'PENDING_REVIEW')::int AS pending_review,
        COUNT(*) FILTER (WHERE review_status = 'DONE')::int AS done_reviews,
        COUNT(*) FILTER (WHERE review_status = 'REQUIRES_UPDATE')::int AS requires_update,
        COUNT(*) FILTER (WHERE review_status = 'NEEDS_MODIFICATION')::int AS needs_modification
      FROM baete_task_evidence;
    `;

    const moduleRows = await prisma.$queryRaw<
      Array<{
        module_code: string;
        module_title: string;
        route_path: string | null;
        total_tasks: number;
        completed_tasks: number;
        overdue_tasks: number;
        pending_review_tasks: number;
      }>
    >`
      SELECT
        m.module_code,
        m.module_title,
        m.route_path,
        COUNT(t.id)::int AS total_tasks,
        COUNT(t.id) FILTER (WHERE t.is_completed = TRUE)::int AS completed_tasks,
        COUNT(t.id) FILTER (
          WHERE t.due_date IS NOT NULL
            AND t.due_date < CURRENT_DATE
            AND t.is_completed = FALSE
        )::int AS overdue_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'SUBMITTED')::int AS pending_review_tasks
      FROM baete_workspace_modules m
      LEFT JOIN baete_task_groups g
        ON g.module_id = m.id
        AND g.is_active = TRUE
      LEFT JOIN baete_tasks t
        ON t.task_group_id = g.id
        AND t.is_active = TRUE
      WHERE m.is_active = TRUE
      GROUP BY
        m.id,
        m.module_code,
        m.module_title,
        m.route_path,
        m.display_order
      ORDER BY m.display_order ASC;
    `;

    const committeeRows = await prisma.$queryRaw<
      Array<{
        committee_code: string;
        committee_name: string;
        total_tasks: number;
        completed_tasks: number;
        overdue_tasks: number;
        pending_review_tasks: number;
      }>
    >`
      SELECT
        c.committee_code,
        c.committee_name,
        COUNT(t.id)::int AS total_tasks,
        COUNT(t.id) FILTER (WHERE t.is_completed = TRUE)::int AS completed_tasks,
        COUNT(t.id) FILTER (
          WHERE t.due_date IS NOT NULL
            AND t.due_date < CURRENT_DATE
            AND t.is_completed = FALSE
        )::int AS overdue_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'SUBMITTED')::int AS pending_review_tasks
      FROM baete_committees c
      LEFT JOIN baete_tasks t
        ON t.assigned_committee_id = c.id
        AND t.is_active = TRUE
      WHERE c.is_active = TRUE
      GROUP BY
        c.id,
        c.committee_code,
        c.committee_name,
        c.display_order
      ORDER BY c.display_order ASC, c.committee_name ASC;
    `;

    return NextResponse.json({
      success: true,
      summary: summaryRows[0] || null,
      evidence: evidenceRows[0] || null,
      modules: moduleRows,
      committees: committeeRows,
    });
  } catch (error) {
    console.error("BAETE dashboard summary error:", error);
    return NextResponse.json(
      { error: "Failed to load BAETE dashboard summary." },
      { status: 500 }
    );
  }
}

import Link from "next/link";
import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import BaeteDashboardAlerts from "@/components/baete-dashboard-alerts";

type ModuleSummary = {
  id: number;
  module_code: string;
  module_title: string;
  description: string | null;
  route_path: string | null;
  total_tasks: number;
  completed_tasks: number;
  critical_tasks: number;
};

export default async function AccreditationWorkspacePage() {
  await requireCoordinatorOrAdmin();

  const modules = await prisma.$queryRaw<ModuleSummary[]>`
    SELECT
      m.id,
      m.module_code,
      m.module_title,
      m.description,
      m.route_path,
      COUNT(t.id)::int AS total_tasks,
      COUNT(t.id) FILTER (WHERE t.is_completed = TRUE)::int AS completed_tasks,
      COUNT(t.id) FILTER (WHERE t.is_critical = TRUE AND t.is_completed = FALSE)::int AS critical_tasks
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
      m.description,
      m.route_path,
      m.display_order
    ORDER BY m.display_order ASC;
  `;

  return (
    <BaeteWorkspaceShell
      title="ADUST EEE — BAETE Accreditation Readiness Report"
      subtitle="Dynamic accreditation workspace for roadmap, Gantt chart, weekly plan, prerequisites, documentation, mock audit, evidence review, assigned work queues, and committee-wise tracking."
    >
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-r from-blue-950 via-blue-900 to-slate-950 p-8 text-white shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
                Electrical & Electronic Engineering Program
              </p>
              <h2 className="mt-3 text-3xl font-bold">
                BAETE 3.0 Accreditation Workspace
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-blue-100">
                This workspace is connected with live UniFlow data. Each module
                tracks assigned committees, assigned persons, task completion,
                uploaded evidence, review decisions, overdue actions, and
                revision feedback.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Link
                href="/admin/accreditation/my-tasks"
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950"
              >
                Open My Tasks
              </Link>
              <Link
                href="/admin/accreditation/review-queue"
                className="rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Evidence Review Queue
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-4 py-2">
              24-Month Implementation Cycle
            </span>
            <span className="rounded-full bg-white/15 px-4 py-2">
              104-Week Controlled Plan
            </span>
            <span className="rounded-full bg-emerald-500/40 px-4 py-2">
              Assigned User Tracking Active
            </span>
            <span className="rounded-full bg-violet-500/40 px-4 py-2">
              Evidence Review Active
            </span>
            <span className="rounded-full bg-red-500/40 px-4 py-2">
              Overdue Alerts Active
            </span>
          </div>
        </section>

        <BaeteDashboardAlerts />

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const percent =
              module.total_tasks === 0
                ? 0
                : Math.round(
                    (module.completed_tasks / module.total_tasks) * 100
                  );

            return (
              <Link
                key={module.id}
                href={module.route_path || "/admin/accreditation"}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                      {module.module_code}
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-slate-950">
                      {module.module_title}
                    </h3>
                  </div>

                  <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">
                    {percent}%
                  </div>
                </div>

                {module.description ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {module.description}
                  </p>
                ) : null}

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                    Tasks: {module.total_tasks}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
                    Done: {module.completed_tasks}
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">
                    Critical Open: {module.critical_tasks}
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </BaeteWorkspaceShell>
  );
}

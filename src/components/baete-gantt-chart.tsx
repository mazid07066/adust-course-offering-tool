"use client";

import { useEffect, useMemo, useState } from "react";

type TaskRow = {
  id: number;
  group_title: string;
  task_code: string | null;
  title: string;
  priority: string;
  status: string;
  is_completed: boolean;
  assigned_committee_code: string | null;
  start_month: number | null;
  end_month: number | null;
  start_week: number | null;
  end_week: number | null;
};

type TaskGroup = {
  id: number;
  group_title: string;
  tasks: TaskRow[];
};

type ApiResponse = {
  groups?: TaskGroup[];
  error?: string;
};

const months = Array.from({ length: 24 }, (_, index) => index + 1);

function monthFromWeek(week: number | null) {
  if (!week) return null;
  return Math.min(24, Math.max(1, Math.ceil(week / 4.33)));
}

function getStartMonth(task: TaskRow) {
  return task.start_month || monthFromWeek(task.start_week) || 1;
}

function getEndMonth(task: TaskRow) {
  return task.end_month || monthFromWeek(task.end_week) || getStartMonth(task);
}

function barClass(task: TaskRow) {
  if (task.is_completed) return "bg-emerald-600";
  if (task.priority === "CRITICAL") return "bg-red-600";
  if (task.priority === "HIGH") return "bg-orange-500";
  return "bg-blue-600";
}

export default function BaeteGanttChart() {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        "/api/admin/accreditation/tasks?moduleCode=GANTT_24_MONTH",
        { cache: "no-store" }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load Gantt data.");
      }

      setGroups(json.groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Gantt data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const tasks = useMemo(() => groups.flatMap((group) => group.tasks), [groups]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-slate-950">
            Visual 24-Month Gantt Chart
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This chart is generated from the dynamic task start/end month or
            week fields. Add tasks below and they will appear here after refresh.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="w-fit rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Refresh Gantt
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
          Loading Gantt chart...
        </div>
      ) : null}

      {!loading && tasks.length === 0 ? (
        <div className="rounded-xl bg-amber-50 p-6 text-center text-sm text-amber-800">
          No Gantt tasks found.
        </div>
      ) : null}

      {!loading && tasks.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[1280px]">
            <div className="grid grid-cols-[320px_repeat(24,minmax(42px,1fr))] border border-slate-200 text-xs">
              <div className="sticky left-0 z-10 bg-slate-950 px-3 py-3 font-bold text-white">
                Activity / Deliverable
              </div>

              {months.map((month) => (
                <div
                  key={month}
                  className="border-l border-slate-700 bg-slate-950 px-2 py-3 text-center font-bold text-white"
                >
                  M{month}
                </div>
              ))}

              {tasks.map((task) => {
                const startMonth = getStartMonth(task);
                const endMonth = getEndMonth(task);
                const span = Math.max(1, endMonth - startMonth + 1);

                return (
                  <div
                    key={task.id}
                    className="contents"
                  >
                    <div className="sticky left-0 z-10 border-t border-slate-200 bg-white px-3 py-3">
                      <div className="font-bold text-slate-900">
                        {task.task_code ? `${task.task_code} — ` : ""}
                        {task.title}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {task.assigned_committee_code || "Unassigned"} ·{" "}
                        {task.status}
                      </div>
                    </div>

                    {months.map((month) => {
                      const isStart = month === startMonth;
                      const isWithin = month >= startMonth && month <= endMonth;

                      if (isStart) {
                        return (
                          <div
                            key={`${task.id}-${month}`}
                            className="relative border-l border-t border-slate-200 bg-slate-50 px-1 py-3"
                            style={{ gridColumn: `span ${span}` }}
                          >
                            <div
                              className={`h-6 rounded-md ${barClass(task)} shadow-sm`}
                              title={task.title}
                            />
                          </div>
                        );
                      }

                      if (isWithin) return null;

                      return (
                        <div
                          key={`${task.id}-${month}`}
                          className="border-l border-t border-slate-200 bg-slate-50 px-1 py-3"
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700">
                Normal / Pending
              </span>
              <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-700">
                High
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">
                Critical
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
                Completed
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

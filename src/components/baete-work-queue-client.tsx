"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type QueueMode =
  | "all"
  | "my"
  | "committee"
  | "review"
  | "overdue"
  | "needs_revision"
  | "unassigned";

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
  completed_at: string | null;
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
  due_date: string | null;
  pending_evidence_count: number;
  total_evidence_count: number;
};

type Committee = {
  id: number;
  committee_code: string;
  committee_name: string;
};

type UserOption = {
  id: number;
  display_name: string;
  email: string | null;
  role: string | null;
};

type BaeteWorkQueueClientProps = {
  mode: QueueMode;
  title: string;
  subtitle: string;
  defaultUserId?: number | null;
};

const modeLabels: Record<QueueMode, string> = {
  all: "All Tasks",
  my: "My Tasks",
  committee: "Committee Tasks",
  review: "Pending Review",
  overdue: "Overdue",
  needs_revision: "Needs Revision",
  unassigned: "Unassigned",
};

function priorityClass(priority: string) {
  if (priority === "CRITICAL") return "bg-red-100 text-red-700";
  if (priority === "HIGH") return "bg-orange-100 text-orange-700";
  if (priority === "LOW") return "bg-slate-100 text-slate-600";
  return "bg-blue-100 text-blue-700";
}

function statusClass(status: string) {
  if (status === "VERIFIED" || status === "COMPLETED") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "SUBMITTED") return "bg-violet-100 text-violet-700";
  if (status === "NEEDS_REVISION") return "bg-amber-100 text-amber-800";
  if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-700";

  return "bg-slate-100 text-slate-700";
}

function timelineText(task: QueueTask) {
  const parts: string[] = [];

  if (task.start_month && task.end_month) {
    parts.push(`M${task.start_month}–M${task.end_month}`);
  } else if (task.start_month) {
    parts.push(`M${task.start_month}`);
  }

  if (task.start_week && task.end_week) {
    parts.push(`W${task.start_week}–W${task.end_week}`);
  } else if (task.start_week) {
    parts.push(`W${task.start_week}`);
  }

  if (task.due_date) {
    parts.push(`Due ${task.due_date.slice(0, 10)}`);
  }

  return parts.length ? parts.join(" · ") : "Timeline not set";
}

function isOverdue(task: QueueTask) {
  if (!task.due_date || task.is_completed) return false;
  const due = new Date(task.due_date);
  const now = new Date();
  due.setHours(23, 59, 59, 999);
  return due < now;
}

export default function BaeteWorkQueueClient({
  mode,
  title,
  subtitle,
  defaultUserId = null,
}: BaeteWorkQueueClientProps) {
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(
    defaultUserId ? String(defaultUserId) : ""
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const completedCount = useMemo(
    () => tasks.filter((task) => task.is_completed).length,
    [tasks]
  );

  const criticalOpenCount = useMemo(
    () =>
      tasks.filter((task) => task.is_critical && !task.is_completed).length,
    [tasks]
  );

  const pendingEvidenceCount = useMemo(
    () =>
      tasks.reduce((sum, task) => sum + Number(task.pending_evidence_count || 0), 0),
    [tasks]
  );

  async function loadQueue() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("mode", mode);

      if (mode === "committee" && selectedCommitteeId) {
        params.set("committeeId", selectedCommitteeId);
      }

      if (mode === "my" && selectedUserId) {
        params.set("userId", selectedUserId);
      }

      const res = await fetch(`/api/admin/accreditation/work-queue?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load queue.");
      }

      setTasks(json.tasks || []);
      setCommittees(json.committees || []);
      setUsers(json.users || []);

      if (mode === "committee" && !selectedCommitteeId && json.committees?.[0]?.id) {
        setSelectedCommitteeId(String(json.committees[0].id));
      }

      if (mode === "my" && !selectedUserId && json.users?.[0]?.id) {
        setSelectedUserId(String(json.users[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue.");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, [mode, selectedCommitteeId, selectedUserId]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              {modeLabels[mode]}
            </div>
            <h2 className="font-serif text-3xl text-slate-950">{title}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {mode === "committee" ? (
              <select
                value={selectedCommitteeId}
                onChange={(event) => setSelectedCommitteeId(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              >
                {committees.map((committee) => (
                  <option key={committee.id} value={committee.id}>
                    {committee.committee_code} — {committee.committee_name}
                  </option>
                ))}
              </select>
            ) : null}

            {mode === "my" ? (
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name}
                    {user.role ? ` — ${user.role}` : ""}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={loadQueue}
              disabled={loading}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Tasks
            </div>
            <div className="mt-2 text-3xl font-black text-slate-950">
              {tasks.length}
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              Completed
            </div>
            <div className="mt-2 text-3xl font-black text-emerald-800">
              {completedCount}
            </div>
          </div>

          <div className="rounded-2xl bg-violet-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
              Pending Evidence
            </div>
            <div className="mt-2 text-3xl font-black text-violet-800">
              {pendingEvidenceCount}
            </div>
          </div>

          <div className="rounded-2xl bg-red-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">
              Critical Open
            </div>
            <div className="mt-2 text-3xl font-black text-red-800">
              {criticalOpenCount}
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Loading work queue...
        </div>
      ) : null}

      {!loading && tasks.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-800 shadow-sm">
          No tasks found for this queue.
        </div>
      ) : null}

      <section className="space-y-4">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-2xl border bg-white p-5 shadow-sm ${
              isOverdue(task)
                ? "border-red-200"
                : task.status === "NEEDS_REVISION"
                  ? "border-amber-200"
                  : "border-slate-200"
            }`}
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  {task.task_code ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                      {task.task_code}
                    </span>
                  ) : null}

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityClass(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
                      task.status
                    )}`}
                  >
                    {task.status}
                  </span>

                  {task.is_critical && !task.is_completed ? (
                    <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                      CRITICAL OPEN
                    </span>
                  ) : null}

                  {isOverdue(task) ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                      OVERDUE
                    </span>
                  ) : null}

                  {task.pending_evidence_count > 0 ? (
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
                      {task.pending_evidence_count} EVIDENCE PENDING
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-3 text-lg font-bold text-slate-950">
                  {task.title}
                </h3>

                {task.description ? (
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {task.description}
                  </p>
                ) : null}

                <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                  <div>
                    <span className="font-bold text-slate-700">Module:</span>{" "}
                    {task.module_title}
                  </div>

                  <div>
                    <span className="font-bold text-slate-700">Group:</span>{" "}
                    {task.group_title}
                  </div>

                  <div>
                    <span className="font-bold text-slate-700">Committee:</span>{" "}
                    {task.assigned_committee_name || "Unassigned"}
                  </div>

                  <div>
                    <span className="font-bold text-slate-700">User:</span>{" "}
                    {task.assigned_user_label || "Unassigned"}
                  </div>

                  <div>
                    <span className="font-bold text-slate-700">Timeline:</span>{" "}
                    {timelineText(task)}
                  </div>

                  <div>
                    <span className="font-bold text-slate-700">Evidence:</span>{" "}
                    {task.evidence_reference || "Not set"} ·{" "}
                    {task.total_evidence_count} uploaded
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={task.route_path || "/admin/accreditation"}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700"
                >
                  Open Module
                </Link>

                <Link
                  href="/admin/accreditation/roadmap/weekly-plan"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                >
                  Manage Task
                </Link>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

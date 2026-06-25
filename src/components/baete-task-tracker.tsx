"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Committee = {
  id: number;
  committee_code: string;
  committee_name: string;
};

type BaeteTask = {
  id: number;
  task_group_id: number;
  group_code: string;
  group_title: string;
  module_code: string;
  module_title: string;
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
  completed_at: string | null;
  completion_note: string | null;
  assigned_committee_id: number | null;
  assigned_committee_code: string | null;
  assigned_committee_name: string | null;
  start_month: number | null;
  end_month: number | null;
  start_week: number | null;
  end_week: number | null;
  due_date: string | null;
  display_order: number;
};

type TaskGroup = {
  id: number;
  group_code: string;
  group_title: string;
  description: string | null;
  display_order: number;
  tasks: BaeteTask[];
};

type EvidenceItem = {
  id: number;
  original_file_name: string;
  file_size_bytes: number;
  evidence_note: string | null;
  review_status: string;
  reviewer_feedback: string | null;
  reviewed_at: string | null;
  created_at: string;
  download_url: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  groups?: TaskGroup[];
  committees?: Committee[];
};

type BaeteTaskTrackerProps = {
  moduleCode: string;
  title: string;
  subtitle: string;
  badge?: string;
};

const STATUS_OPTIONS = [
  "PENDING",
  "IN_PROGRESS",
  "SUBMITTED",
  "NEEDS_REVISION",
  "COMPLETED",
  "VERIFIED",
];

const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

const REVIEW_OPTIONS = [
  { value: "DONE", label: "Done" },
  { value: "REQUIRES_UPDATE", label: "Requires update" },
  { value: "NEEDS_MODIFICATION", label: "Needs modification" },
];

function priorityClass(priority: string) {
  const value = priority.toUpperCase();

  if (value === "CRITICAL") return "bg-red-100 text-red-700";
  if (value === "HIGH") return "bg-orange-100 text-orange-700";
  if (value === "LOW") return "bg-slate-100 text-slate-600";

  return "bg-blue-100 text-blue-700";
}

function statusClass(status: string) {
  const value = status.toUpperCase();

  if (value === "COMPLETED" || value === "VERIFIED") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (value === "IN_PROGRESS") return "bg-blue-100 text-blue-700";
  if (value === "NEEDS_REVISION") return "bg-amber-100 text-amber-800";
  if (value === "SUBMITTED") return "bg-violet-100 text-violet-700";

  return "bg-slate-100 text-slate-700";
}

function reviewClass(status: string) {
  if (status === "DONE") return "bg-emerald-100 text-emerald-700";
  if (status === "REQUIRES_UPDATE") return "bg-amber-100 text-amber-800";
  if (status === "NEEDS_MODIFICATION") return "bg-red-100 text-red-700";

  return "bg-slate-100 text-slate-700";
}

function timelineText(task: BaeteTask) {
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
    parts.push(`Due: ${task.due_date.slice(0, 10)}`);
  }

  return parts.length ? parts.join(" · ") : "Timeline not set";
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function EvidencePanel({ taskId, onRefresh }: { taskId: number; onRefresh: () => void }) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [reviewFeedbackById, setReviewFeedbackById] = useState<Record<number, string>>({});
  const [reviewStatusById, setReviewStatusById] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadEvidence() {
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/accreditation/tasks/${taskId}/evidence`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load evidence.");
      }

      setEvidence(json.evidence || []);
    } catch (error) {
      console.error(error);
      setEvidence([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvidence();
  }, [taskId]);

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      alert("Please select a PDF, Word, PowerPoint, or Excel file.");
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("evidenceNote", evidenceNote);

      const res = await fetch(`/api/admin/accreditation/tasks/${taskId}/evidence`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to upload evidence.");
      }

      setFile(null);
      setEvidenceNote("");
      await loadEvidence();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload evidence.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewEvidence(evidenceId: number) {
    const reviewStatus = reviewStatusById[evidenceId];

    if (!reviewStatus) {
      alert("Please select a review decision.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        `/api/admin/accreditation/evidence/${evidenceId}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_status: reviewStatus,
            reviewer_feedback: reviewFeedbackById[evidenceId] || "",
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to review evidence.");
      }

      await loadEvidence();
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to review evidence.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h5 className="text-sm font-bold text-slate-950">Evidence Upload</h5>
          <p className="mt-1 text-xs text-slate-500">
            Supported: PDF, Word, PowerPoint, Excel. Supervisor can review with feedback.
          </p>
        </div>

        <button
          type="button"
          onClick={loadEvidence}
          className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
        >
          Refresh Evidence
        </button>
      </div>

      <form onSubmit={uploadEvidence} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <input
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        />

        <input
          value={evidenceNote}
          onChange={(event) => setEvidenceNote(event.target.value)}
          placeholder="Evidence note, e.g. Uploaded final rubric file"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? "Uploading..." : "Upload"}
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="text-xs text-slate-500">Loading evidence...</div>
        ) : null}

        {!loading && evidence.length === 0 ? (
          <div className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500">
            No evidence uploaded yet.
          </div>
        ) : null}

        {evidence.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <a
                  href={item.download_url}
                  className="font-bold text-blue-700 hover:underline"
                >
                  {item.original_file_name}
                </a>

                <div className="mt-1 text-xs text-slate-500">
                  {formatFileSize(item.file_size_bytes)} · Uploaded{" "}
                  {new Date(item.created_at).toLocaleString()}
                </div>

                {item.evidence_note ? (
                  <div className="mt-2 text-sm text-slate-700">
                    {item.evidence_note}
                  </div>
                ) : null}

                <div className="mt-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${reviewClass(
                      item.review_status
                    )}`}
                  >
                    {item.review_status.replaceAll("_", " ")}
                  </span>
                </div>

                {item.reviewer_feedback ? (
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-bold">Supervisor feedback:</span>{" "}
                    {item.reviewer_feedback}
                  </div>
                ) : null}
              </div>

              <div className="grid min-w-[320px] gap-2">
                <select
                  value={reviewStatusById[item.id] || ""}
                  onChange={(event) =>
                    setReviewStatusById((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select review decision</option>
                  {REVIEW_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <textarea
                  value={reviewFeedbackById[item.id] || ""}
                  onChange={(event) =>
                    setReviewFeedbackById((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  placeholder="Feedback to uploader"
                  className="h-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />

                <button
                  type="button"
                  onClick={() => reviewEvidence(item.id)}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  Save Review
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BaeteTaskTracker({
  moduleCode,
  title,
  subtitle,
  badge,
}: BaeteTaskTrackerProps) {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [newTask, setNewTask] = useState({
    task_group_id: "",
    task_code: "",
    title: "",
    description: "",
    deliverable: "",
    evidence_format: "",
    evidence_reference: "",
    priority: "NORMAL",
    assigned_committee_id: "",
    start_month: "",
    end_month: "",
    start_week: "",
    end_week: "",
    requires_checkbox: true,
  });

  const allTasks = useMemo(
    () => groups.flatMap((group) => group.tasks),
    [groups]
  );

  const completedCount = allTasks.filter((task) => task.is_completed).length;
  const totalCount = allTasks.length;
  const completionPercent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  async function loadData() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/admin/accreditation/tasks?moduleCode=${encodeURIComponent(
          moduleCode
        )}`,
        { cache: "no-store" }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load BAETE tasks.");
      }

      setGroups(json.groups || []);
      setCommittees(json.committees || []);

      if ((json.groups || []).length > 0 && !newTask.task_group_id) {
        setNewTask((current) => ({
          ...current,
          task_group_id: String(json.groups?.[0]?.id || ""),
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load BAETE tasks.");
      setGroups([]);
      setCommittees([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [moduleCode]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!newTask.title.trim()) {
      setError("Task title is required.");
      return;
    }

    try {
      const res = await fetch("/api/admin/accreditation/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_group_id: newTask.task_group_id,
          task_code: newTask.task_code,
          title: newTask.title,
          description: newTask.description,
          deliverable: newTask.deliverable,
          evidence_format: newTask.evidence_format,
          evidence_reference: newTask.evidence_reference,
          priority: newTask.priority,
          assigned_committee_id: newTask.assigned_committee_id || null,
          start_month: newTask.start_month || null,
          end_month: newTask.end_month || null,
          start_week: newTask.start_week || null,
          end_week: newTask.end_week || null,
          requires_checkbox: newTask.requires_checkbox,
          is_critical: newTask.priority === "CRITICAL",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create task.");
      }

      setMessage("Task created successfully.");
      setNewTask((current) => ({
        ...current,
        task_code: "",
        title: "",
        description: "",
        deliverable: "",
        evidence_format: "",
        evidence_reference: "",
        start_month: "",
        end_month: "",
        start_week: "",
        end_week: "",
      }));

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    }
  }

  async function updateTask(
    task: BaeteTask,
    patch: {
      assigned_committee_id?: number | null;
      status?: string;
      is_completed?: boolean;
      completion_note?: string | null;
    }
  ) {
    setSavingTaskId(task.id);
    setError("");
    setMessage("");

    const nextCompleted =
      typeof patch.is_completed === "boolean"
        ? patch.is_completed
        : task.is_completed;

    const nextStatus =
      patch.status ||
      (nextCompleted && task.status === "PENDING" ? "COMPLETED" : task.status);

    try {
      const res = await fetch(`/api/admin/accreditation/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_committee_id:
            patch.assigned_committee_id !== undefined
              ? patch.assigned_committee_id
              : task.assigned_committee_id,
          status: nextStatus,
          is_completed: nextCompleted,
          completion_note:
            patch.completion_note !== undefined
              ? patch.completion_note
              : task.completion_note,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update task.");
      }

      await loadData();
      setMessage("Task updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setSavingTaskId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {badge ? (
              <div className="mb-2 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
                {badge}
              </div>
            ) : null}

            <h2 className="font-serif text-3xl text-slate-950">{title}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAddTask((value) => !value)}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {showAddTask ? "Hide Task Form" : "Add Task"}
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-emerald-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-bold text-emerald-800">
                Completion Progress
              </div>
              <div className="mt-1 text-sm text-emerald-700">
                {completedCount} of {totalCount} tasks completed
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-200 text-lg font-black text-emerald-800">
                {completionPercent}%
              </div>
              <div className="h-3 w-64 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {showAddTask ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">
            Super Admin Task Input
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Add weekly-plan or Gantt tasks here. Gantt tasks use start/end month
            or week values to draw the chart.
          </p>

          <form onSubmit={createTask} className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Task Group
              </span>
              <select
                value={newTask.task_group_id}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    task_group_id: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.group_title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Task Code
              </span>
              <input
                value={newTask.task_code}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    task_code: event.target.value,
                  }))
                }
                placeholder="WEEKLY-003"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="xl:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Title
              </span>
              <input
                value={newTask.title}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Prepare CO-PO mapping matrix"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="xl:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Description
              </span>
              <textarea
                value={newTask.description}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="mt-1 h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="xl:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Deliverable
              </span>
              <textarea
                value={newTask.deliverable}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    deliverable: event.target.value,
                  }))
                }
                className="mt-1 h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Committee
              </span>
              <select
                value={newTask.assigned_committee_id}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    assigned_committee_id: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {committees.map((committee) => (
                  <option key={committee.id} value={committee.id}>
                    {committee.committee_code} — {committee.committee_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Priority
              </span>
              <select
                value={newTask.priority}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Start Month
              </span>
              <input
                type="number"
                min="1"
                max="24"
                value={newTask.start_month}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    start_month: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                End Month
              </span>
              <input
                type="number"
                min="1"
                max="24"
                value={newTask.end_month}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    end_month: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Start Week
              </span>
              <input
                type="number"
                min="1"
                max="104"
                value={newTask.start_week}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    start_week: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                End Week
              </span>
              <input
                type="number"
                min="1"
                max="104"
                value={newTask.end_week}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    end_week: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="xl:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Evidence Format
              </span>
              <input
                value={newTask.evidence_format}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    evidence_format: event.target.value,
                  }))
                }
                placeholder="PDF report, signed meeting minutes, Excel matrix"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="xl:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Evidence Reference
              </span>
              <input
                value={newTask.evidence_reference}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    evidence_reference: event.target.value,
                  }))
                }
                placeholder="EEE-CO-PO-2026-W12"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={newTask.requires_checkbox}
                onChange={(event) =>
                  setNewTask((current) => ({
                    ...current,
                    requires_checkbox: event.target.checked,
                  }))
                }
              />
              Requires completion checkbox
            </label>

            <div className="xl:col-span-4">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"
              >
                Create Task
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Loading dynamic BAETE task data...
        </div>
      ) : null}

      <div className="space-y-6">
        {groups.map((group) => (
          <section
            key={group.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-5 rounded-xl bg-slate-100 px-4 py-3">
              <h3 className="font-bold text-slate-950">{group.group_title}</h3>
              {group.description ? (
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {group.description}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              {group.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`rounded-2xl border p-4 transition ${
                    task.is_completed
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px_170px_150px] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
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

                        {task.is_critical ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                            CRITICAL
                          </span>
                        ) : null}
                      </div>

                      <h4 className="mt-3 text-base font-bold text-slate-950">
                        {task.title}
                      </h4>

                      {task.description ? (
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {task.description}
                        </p>
                      ) : null}

                      <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                        <div>
                          <span className="font-bold text-slate-700">
                            Timeline:
                          </span>{" "}
                          {timelineText(task)}
                        </div>

                        <div>
                          <span className="font-bold text-slate-700">
                            Evidence:
                          </span>{" "}
                          {task.evidence_reference || "Not set"}
                        </div>

                        {task.deliverable ? (
                          <div className="md:col-span-2">
                            <span className="font-bold text-slate-700">
                              Deliverable:
                            </span>{" "}
                            {task.deliverable}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Assigned Committee
                      </label>
                      <select
                        value={task.assigned_committee_id || ""}
                        disabled={savingTaskId === task.id}
                        onChange={(event) =>
                          updateTask(task, {
                            assigned_committee_id: event.target.value
                              ? Number(event.target.value)
                              : null,
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <option value="">Unassigned</option>
                        {committees.map((committee) => (
                          <option key={committee.id} value={committee.id}>
                            {committee.committee_code} —{" "}
                            {committee.committee_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Status
                      </label>
                      <select
                        value={task.status}
                        disabled={savingTaskId === task.id}
                        onChange={(event) =>
                          updateTask(task, {
                            status: event.target.value,
                            is_completed:
                              event.target.value === "COMPLETED" ||
                              event.target.value === "VERIFIED",
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-3 xl:justify-end xl:pt-7">
                      {task.requires_checkbox ? (
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={task.is_completed}
                            disabled={savingTaskId === task.id}
                            onChange={(event) =>
                              updateTask(task, {
                                is_completed: event.target.checked,
                                status: event.target.checked
                                  ? "COMPLETED"
                                  : "PENDING",
                              })
                            }
                            className="h-4 w-4"
                          />
                          Done
                        </label>
                      ) : (
                        <span className="text-xs text-slate-400">
                          No checkbox
                        </span>
                      )}
                    </div>
                  </div>

                  {task.completed_at ? (
                    <div className="mt-3 text-xs font-medium text-emerald-700">
                      Completed at: {new Date(task.completed_at).toLocaleString()}
                    </div>
                  ) : null}

                  <EvidencePanel taskId={task.id} onRefresh={loadData} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

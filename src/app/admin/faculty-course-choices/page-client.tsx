"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type ChoiceCourse = {
  selectionId: number;
  offeredCourseId: number;
  priorityOrder: number | null;
  status: string;
  selectedAt: string | null;
  confirmedAt: string | null;
  programCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  batchCodes: string[];
};

type AssignedCourse = {
  assignmentId: number;
  offeredCourseId: number;
  programCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  batchCodes: string[];
  assignedCredit: number;
  loadType: string;
};

type FacultyChoiceGroup = {
  teacherId: number;
  teacherCode: string;
  teacherName: string;
  designation: string | null;
  totalChoices: number;
  finalizedCount: number;
  bufferCount: number;
  approvedAssignedCount: number;
  approvedAssignedCredits: number;
  choices: ChoiceCourse[];
  assignments: AssignedCourse[];
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  termName?: string;
  facultyChoices?: FacultyChoiceGroup[];
};

export default function FacultyCourseChoicesAdminPageClient() {
  const { terms, termName, setTermName, loadingTerms, termError } = useAcademicTerms();

  const [loading, setLoading] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState<string>("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [facultyChoices, setFacultyChoices] = useState<FacultyChoiceGroup[]>([]);

  async function loadChoices() {
    if (!termName) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/faculty-course-choices?termName=${encodeURIComponent(termName)}`,
        {
          cache: "no-store",
        }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load faculty course choices.");
      }

      setFacultyChoices(json.facultyChoices || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load faculty course choices."
      );
      setFacultyChoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (termName) {
      loadChoices();
    }
  }, [termName]);

  async function handleApprove(teacherId: number, teacherLabel: string) {
    if (!termName) {
      setError("Please select a term first.");
      return;
    }

    const ok = window.confirm(
      `Approve FINAL choices for ${teacherLabel} in ${termName} and apply them to the assignment board?`
    );
    if (!ok) return;

    setActionLoadingKey(`approve-${teacherId}`);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/faculty-course-choices/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherId,
          termName,
        }),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to approve faculty choices.");
      }

      setMessage(json.message || "Faculty choices approved successfully.");
      await loadChoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve faculty choices.");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function handleRemoveApprovedAssignment(teacherId: number, teacherLabel: string) {
    if (!termName) {
      setError("Please select a term first.");
      return;
    }

    const ok = window.confirm(
      `Remove approved assignment rows for ${teacherLabel} in ${termName}?`
    );
    if (!ok) return;

    setActionLoadingKey(`remove-approved-${teacherId}`);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        "/api/admin/faculty-course-choices/remove-approved-assignment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teacherId,
            termName,
          }),
        }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to remove approved assignment.");
      }

      setMessage(json.message || "Approved assignment removed successfully.");
      await loadChoices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove approved assignment."
      );
    } finally {
      setActionLoadingKey("");
    }
  }

  async function handleReopen(teacherId: number, teacherLabel: string) {
    if (!termName) {
      setError("Please select a term first.");
      return;
    }

    const ok = window.confirm(
      `Reopen finalized choices for ${teacherLabel} in ${termName}?`
    );
    if (!ok) return;

    setActionLoadingKey(`reopen-${teacherId}`);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/faculty-course-choices/reopen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherId,
          termName,
        }),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to reopen faculty choices.");
      }

      setMessage(json.message || "Faculty choices reopened successfully.");
      await loadChoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen faculty choices.");
    } finally {
      setActionLoadingKey("");
    }
  }

  async function handleReset(teacherId: number, teacherLabel: string) {
    if (!termName) {
      setError("Please select a term first.");
      return;
    }

    const ok = window.confirm(
      `Reset all faculty choices for ${teacherLabel} in ${termName}? This will delete BUFFER and FINAL records for that faculty in the selected term.`
    );
    if (!ok) return;

    setActionLoadingKey(`reset-${teacherId}`);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/faculty-course-choices/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherId,
          termName,
        }),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to reset faculty choices.");
      }

      setMessage(json.message || "Faculty choices reset successfully.");
      await loadChoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset faculty choices.");
    } finally {
      setActionLoadingKey("");
    }
  }

  return (
    <AdminLayout title="Faculty Course Choices">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-md">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Academic Term
              </label>
              <select
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                disabled={loadingTerms}
              >
                <option value="">
                  {loadingTerms ? "Loading terms..." : "Select Academic Term"}
                </option>
                {terms.map((term) => (
                  <option key={term.name} value={term.name}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/admin/faculty-assignment"
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open Assignment Board
              </a>

              <button
                type="button"
                onClick={loadChoices}
                disabled={!termName || loading}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? "Loading..." : "Refresh Choices"}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            FINAL faculty choices need approval. Existing imported/manual/preassigned assignments are already authoritative and are shown below as approved assignment rows. They do not require the faculty to log in again.
          </div>
        </div>

        {(error || termError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || termError}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="space-y-4">
          {facultyChoices.map((group) => {
            const teacherLabel = `${group.teacherCode} - ${group.teacherName}`;
            const hasFinal = group.finalizedCount > 0;
            const hasApprovedAssignment = group.approvedAssignedCount > 0;

            return (
              <div
                key={group.teacherId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {teacherLabel}
                    </h2>
                    <div className="mt-1 text-sm text-slate-600">
                      {group.designation || "-"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        Total Choices: {group.totalChoices}
                      </span>
                      <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
                        FINAL: {group.finalizedCount}
                      </span>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                        BUFFER: {group.bufferCount}
                      </span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                        Assigned Sections: {group.approvedAssignedCount}
                      </span>
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-purple-700">
                        Assigned Credits: {group.approvedAssignedCredits}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleApprove(group.teacherId, teacherLabel)}
                      disabled={!hasFinal || actionLoadingKey !== ""}
                      className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      {actionLoadingKey === `approve-${group.teacherId}`
                        ? "Approving..."
                        : "Approve Final Choices"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveApprovedAssignment(group.teacherId, teacherLabel)
                      }
                      disabled={!hasApprovedAssignment || actionLoadingKey !== ""}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {actionLoadingKey === `remove-approved-${group.teacherId}`
                        ? "Removing..."
                        : "Remove Approved Assignment"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReopen(group.teacherId, teacherLabel)}
                      disabled={actionLoadingKey !== ""}
                      className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {actionLoadingKey === `reopen-${group.teacherId}`
                        ? "Reopening..."
                        : "Reopen"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReset(group.teacherId, teacherLabel)}
                      disabled={actionLoadingKey !== ""}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {actionLoadingKey === `reset-${group.teacherId}`
                        ? "Resetting..."
                        : "Reset"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <div>
                    <h3 className="mb-3 text-base font-semibold text-slate-900">
                      Faculty Choice Rows
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="border-b px-3 py-3 text-left">Priority</th>
                            <th className="border-b px-3 py-3 text-left">Status</th>
                            <th className="border-b px-3 py-3 text-left">Program</th>
                            <th className="border-b px-3 py-3 text-left">Course</th>
                            <th className="border-b px-3 py-3 text-left">Section</th>
                            <th className="border-b px-3 py-3 text-left">Batches</th>
                            <th className="border-b px-3 py-3 text-left">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.choices.map((choice) => (
                            <tr key={choice.selectionId}>
                              <td className="border-b px-3 py-2">
                                {choice.priorityOrder || "-"}
                              </td>
                              <td className="border-b px-3 py-2">{choice.status}</td>
                              <td className="border-b px-3 py-2">{choice.programCode}</td>
                              <td className="border-b px-3 py-2">
                                {choice.courseCode} — {choice.courseTitle}
                              </td>
                              <td className="border-b px-3 py-2">{choice.section}</td>
                              <td className="border-b px-3 py-2">
                                {choice.batchCodes.join(", ") || "-"}
                              </td>
                              <td className="border-b px-3 py-2">
                                {choice.status === "FINAL"
                                  ? choice.confirmedAt || "-"
                                  : choice.selectedAt || "-"}
                              </td>
                            </tr>
                          ))}

                          {group.choices.length === 0 && (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-4 py-6 text-center text-slate-500"
                              >
                                No faculty choice rows found for this teacher.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-base font-semibold text-slate-900">
                      Existing Approved Assignment Rows
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="border-b px-3 py-3 text-left">Load Type</th>
                            <th className="border-b px-3 py-3 text-left">Program</th>
                            <th className="border-b px-3 py-3 text-left">Course</th>
                            <th className="border-b px-3 py-3 text-left">Section</th>
                            <th className="border-b px-3 py-3 text-left">Batches</th>
                            <th className="border-b px-3 py-3 text-left">Assigned Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.assignments.map((assignment) => (
                            <tr key={assignment.assignmentId}>
                              <td className="border-b px-3 py-2">{assignment.loadType}</td>
                              <td className="border-b px-3 py-2">{assignment.programCode}</td>
                              <td className="border-b px-3 py-2">
                                {assignment.courseCode} — {assignment.courseTitle}
                              </td>
                              <td className="border-b px-3 py-2">{assignment.section}</td>
                              <td className="border-b px-3 py-2">
                                {assignment.batchCodes.join(", ") || "-"}
                              </td>
                              <td className="border-b px-3 py-2">
                                {assignment.assignedCredit}
                              </td>
                            </tr>
                          ))}

                          {group.assignments.length === 0 && (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-6 text-center text-slate-500"
                              >
                                No existing approved assignment rows found for this teacher.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {facultyChoices.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              No faculty course choices or approved assignments found for the selected term.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
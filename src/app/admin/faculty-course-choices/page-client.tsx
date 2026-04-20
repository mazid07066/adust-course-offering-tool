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

type FacultyChoiceGroup = {
  teacherId: number;
  teacherCode: string;
  teacherName: string;
  designation: string | null;
  totalChoices: number;
  finalizedCount: number;
  bufferCount: number;
  choices: ChoiceCourse[];
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
          {facultyChoices.map((faculty) => {
            const teacherLabel = `${faculty.teacherCode} - ${faculty.teacherName}`;
            const reopenLoading = actionLoadingKey === `reopen-${faculty.teacherId}`;
            const resetLoading = actionLoadingKey === `reset-${faculty.teacherId}`;
            const hasFinal = faculty.finalizedCount > 0;
            const hasAnyChoice = faculty.totalChoices > 0;

            return (
              <div
                key={faculty.teacherId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {faculty.teacherCode} — {faculty.teacherName}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {faculty.designation || "-"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                      Total: {faculty.totalChoices}
                    </span>
                    <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-700">
                      Buffer: {faculty.bufferCount}
                    </span>
                    <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                      Final: {faculty.finalizedCount}
                    </span>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleReopen(faculty.teacherId, teacherLabel)}
                    disabled={!hasFinal || reopenLoading || resetLoading || !termName}
                    className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {reopenLoading ? "Reopening..." : "Reopen Finalized Choices"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReset(faculty.teacherId, teacherLabel)}
                    disabled={!hasAnyChoice || reopenLoading || resetLoading || !termName}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {resetLoading ? "Resetting..." : "Reset All Choices"}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="border-b px-3 py-3 text-left">Priority</th>
                        <th className="border-b px-3 py-3 text-left">Status</th>
                        <th className="border-b px-3 py-3 text-left">Course</th>
                        <th className="border-b px-3 py-3 text-left">Program</th>
                        <th className="border-b px-3 py-3 text-left">Section</th>
                        <th className="border-b px-3 py-3 text-left">Batches</th>
                        <th className="border-b px-3 py-3 text-left">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faculty.choices.map((choice) => (
                        <tr key={choice.selectionId}>
                          <td className="border-b px-3 py-2">
                            {choice.priorityOrder || "-"}
                          </td>
                          <td className="border-b px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                choice.status === "FINAL"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {choice.status}
                            </span>
                          </td>
                          <td className="border-b px-3 py-2">
                            {choice.courseCode} — {choice.courseTitle}
                          </td>
                          <td className="border-b px-3 py-2">{choice.programCode}</td>
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

                      {faculty.choices.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                            No choices submitted.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {facultyChoices.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              No faculty course choices found for the selected term.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
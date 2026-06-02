"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type PreviewRow = {
  rowNumber: number;
  studentId: string;
  fullName: string;
  programCode: string;
  batchCode: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  admissionSemester: string;
  enrollmentStatus: string;
  normalizedStudentId: string;
  inferredBatchCode: string;
  matchedProgramId: number | null;
  matchedProgramLabel: string;
  matchedBatchId: number | null;
  willCreateBatch: boolean;
  existingStudentId: number | null;
  existingEnrollmentId: number | null;
  status: "OK" | "WARNING" | "ERROR";
  issues: string[];
};

type PreviewResponse = {
  success?: boolean;
  error?: string;
  summary?: {
    totalRows: number;
    okRows: number;
    warningRows: number;
    errorRows: number;
    existingStudents: number;
    newStudents: number;
    batchesToCreate: number;
    existingEnrollments: number;
  };
  previewRows?: PreviewRow[];
};

type CommitResponse = {
  success?: boolean;
  error?: string;
  importLogId?: number;
  result?: {
    totalRows: number;
    createdStudents: number;
    updatedStudents: number;
    createdBatches: number;
    createdEnrollments: number;
    updatedEnrollments: number;
    skippedRows: number;
    errors: string[];
  };
};

type ImportLog = {
  id: number;
  import_type: string;
  file_name: string | null;
  file_size: number | null;
  total_rows: number;
  ok_rows: number;
  warning_rows: number;
  error_rows: number;
  committed_rows: number;
  created_students: number;
  updated_students: number;
  created_batches: number;
  created_enrollments: number;
  updated_enrollments: number;
  skipped_rows: number;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
};

type HistoryResponse = {
  success?: boolean;
  error?: string;
  logs?: ImportLog[];
};

export default function StudentBulkImportPageClient() {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<PreviewResponse["summary"] | null>(
    null
  );
  const [commitResult, setCommitResult] =
    useState<CommitResponse["result"] | null>(null);
  const [latestImportLogId, setLatestImportLogId] = useState<number | null>(
    null
  );

  const [history, setHistory] = useState<ImportLog[]>([]);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canPreview = useMemo(
    () => Boolean(file && !loadingPreview),
    [file, loadingPreview]
  );

  const canCommit = useMemo(() => {
    if (!file || loadingCommit || previewRows.length === 0) return false;
    return previewRows.every((row) => row.status !== "ERROR");
  }, [file, loadingCommit, previewRows]);

  async function loadHistory() {
    setLoadingHistory(true);

    try {
      const res = await fetch("/api/admin/students/bulk-import/history?limit=20", {
        cache: "no-store",
      });

      const json: HistoryResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load import history.");
      }

      setHistory(json.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function previewImport() {
    if (!file) {
      setError("Please select a CSV/XLSX file first.");
      setMessage("");
      return;
    }

    setLoadingPreview(true);
    setError("");
    setMessage("");
    setCommitResult(null);
    setLatestImportLogId(null);
    setPreviewRows([]);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/students/bulk-import/preview", {
        method: "POST",
        body: formData,
      });

      const json: PreviewResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Preview failed.");
      }

      setPreviewRows(json.previewRows || []);
      setSummary(json.summary || null);
      setMessage("Preview loaded. Review errors and warnings before commit.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function commitImport() {
    if (!file) {
      setError("Please select a CSV/XLSX file first.");
      setMessage("");
      return;
    }

    if (!canCommit) {
      setError("Commit is blocked. Preview must have no ERROR rows.");
      setMessage("");
      return;
    }

    const confirmed = window.confirm(
      "This will create/update students, batches if missing, and enrollment records. Continue?"
    );

    if (!confirmed) return;

    setLoadingCommit(true);
    setError("");
    setMessage("");
    setCommitResult(null);
    setLatestImportLogId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/students/bulk-import/commit", {
        method: "POST",
        body: formData,
      });

      const json: CommitResponse = await res.json();

      if (!res.ok) {
        if (json.importLogId) {
          setLatestImportLogId(json.importLogId);
        }
        throw new Error(json.error || "Commit failed.");
      }

      setCommitResult(json.result || null);
      setLatestImportLogId(json.importLogId || null);
      setMessage("Student bulk import committed successfully.");

      await previewImport();
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed.");
      await loadHistory();
    } finally {
      setLoadingCommit(false);
    }
  }

  function statusBadge(status: string) {
    const normalized = status.toUpperCase();

    if (normalized === "SUCCESS") return "bg-green-100 text-green-700";

    if (normalized === "PARTIAL_SUCCESS" || normalized === "WARNING") {
      return "bg-amber-100 text-amber-700";
    }

    if (normalized === "BLOCKED" || normalized === "FAILED" || normalized === "ERROR") {
      return "bg-red-100 text-red-700";
    }

    return "bg-slate-100 text-slate-700";
  }

  return (
    <AdminLayout title="Student Bulk Import">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                S1-B — Student Bulk Import and Enrollment Matching
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Upload a CSV/XLSX student list. The official import field is now{" "}
                <b>Admission Semester</b>. Old files with a Session column will still be
                accepted for compatibility.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/admin/students/bulk-import/template";
              }}
              className="inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Download CSV Template
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPreviewRows([]);
                setSummary(null);
                setCommitResult(null);
                setLatestImportLogId(null);
                setError("");
                setMessage("");
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
            />

            <button
              type="button"
              onClick={previewImport}
              disabled={!canPreview}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingPreview ? "Previewing..." : "Preview Import"}
            </button>

            <button
              type="button"
              onClick={commitImport}
              disabled={!canCommit}
              className="rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {loadingCommit ? "Committing..." : "Commit Import"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div>{error}</div>
            {latestImportLogId && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/api/admin/students/bulk-import/history/${latestImportLogId}/errors/export`;
                }}
                className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                Download Error Rows CSV
              </button>
            )}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {summary && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Preview Summary
            </h3>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                Total: {summary.totalRows}
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                OK: {summary.okRows}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                Warnings: {summary.warningRows}
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
                Errors: {summary.errorRows}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                Existing Students: {summary.existingStudents}
              </span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
                New Students: {summary.newStudents}
              </span>
              <span className="rounded-full bg-purple-100 px-3 py-1 font-medium text-purple-700">
                Batches to Create: {summary.batchesToCreate}
              </span>
              <span className="rounded-full bg-cyan-100 px-3 py-1 font-medium text-cyan-700">
                Existing Enrollments: {summary.existingEnrollments}
              </span>
            </div>
          </div>
        )}

        {commitResult && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Commit Result
            </h3>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                Total: {commitResult.totalRows}
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                Created Students: {commitResult.createdStudents}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                Updated Students: {commitResult.updatedStudents}
              </span>
              <span className="rounded-full bg-purple-100 px-3 py-1 font-medium text-purple-700">
                Created Batches: {commitResult.createdBatches}
              </span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
                Created Enrollments: {commitResult.createdEnrollments}
              </span>
              <span className="rounded-full bg-cyan-100 px-3 py-1 font-medium text-cyan-700">
                Updated Enrollments: {commitResult.updatedEnrollments}
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
                Skipped: {commitResult.skippedRows}
              </span>
            </div>

            {latestImportLogId && commitResult.errors.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/api/admin/students/bulk-import/history/${latestImportLogId}/errors/export`;
                }}
                className="mt-4 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                Download Error Rows CSV
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              Preview Rows
            </h3>
            <span className="text-xs text-slate-500">
              {previewRows.length} rows loaded
            </span>
          </div>

          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Row</th>
                <th className="border-b px-3 py-3 text-left">Status</th>
                <th className="border-b px-3 py-3 text-left">Student ID</th>
                <th className="border-b px-3 py-3 text-left">Name</th>
                <th className="border-b px-3 py-3 text-left">Program</th>
                <th className="border-b px-3 py-3 text-left">Batch</th>
                <th className="border-b px-3 py-3 text-left">
                  Admission Semester
                </th>
                <th className="border-b px-3 py-3 text-left">Existing Student</th>
                <th className="border-b px-3 py-3 text-left">
                  Existing Enrollment
                </th>
                <th className="border-b px-3 py-3 text-left">Issues</th>
              </tr>
            </thead>

            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.normalizedStudentId}`}>
                  <td className="border-b px-3 py-2">{row.rowNumber}</td>
                  <td className="border-b px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        row.status === "OK"
                          ? "bg-green-100 text-green-700"
                          : row.status === "WARNING"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="border-b px-3 py-2 font-medium">
                    {row.normalizedStudentId || "-"}
                  </td>
                  <td className="border-b px-3 py-2">{row.fullName || "-"}</td>
                  <td className="border-b px-3 py-2">
                    <div className="font-medium">{row.programCode || "-"}</div>
                    <div className="text-xs text-slate-500">
                      {row.matchedProgramLabel || "Not matched"}
                    </div>
                  </td>
                  <td className="border-b px-3 py-2">
                    <div>{row.inferredBatchCode || "-"}</div>
                    <div className="text-xs text-slate-500">
                      {row.matchedBatchId
                        ? `Matched ID: ${row.matchedBatchId}`
                        : row.willCreateBatch
                          ? "Will create"
                          : "Not matched"}
                    </div>
                  </td>
                  <td className="border-b px-3 py-2">
                    {row.admissionSemester || "-"}
                  </td>
                  <td className="border-b px-3 py-2">
                    {row.existingStudentId
                      ? `Yes (#${row.existingStudentId})`
                      : "No"}
                  </td>
                  <td className="border-b px-3 py-2">
                    {row.existingEnrollmentId
                      ? `Yes (#${row.existingEnrollmentId})`
                      : "No"}
                  </td>
                  <td className="border-b px-3 py-2">
                    {row.issues.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
                        {row.issues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}

              {previewRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    Upload a file and click Preview Import.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              Import History
            </h3>
            <button
              type="button"
              onClick={loadHistory}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {loadingHistory ? "Refreshing..." : "Refresh History"}
            </button>
          </div>

          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">ID</th>
                <th className="border-b px-3 py-3 text-left">Status</th>
                <th className="border-b px-3 py-3 text-left">File</th>
                <th className="border-b px-3 py-3 text-left">Rows</th>
                <th className="border-b px-3 py-3 text-left">Created</th>
                <th className="border-b px-3 py-3 text-left">Updated</th>
                <th className="border-b px-3 py-3 text-left">Enrollments</th>
                <th className="border-b px-3 py-3 text-left">Skipped</th>
                <th className="border-b px-3 py-3 text-left">Time</th>
                <th className="border-b px-3 py-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {history.map((log) => (
                <tr key={log.id}>
                  <td className="border-b px-3 py-2">#{log.id}</td>
                  <td className="border-b px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(
                        log.status
                      )}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="border-b px-3 py-2">
                    <div className="font-medium">{log.file_name || "-"}</div>
                    <div className="text-xs text-slate-500">
                      {log.message || "-"}
                    </div>
                  </td>
                  <td className="border-b px-3 py-2">
                    {log.total_rows} total / {log.committed_rows} committed
                  </td>
                  <td className="border-b px-3 py-2">
                    Students {log.created_students} / Batches {log.created_batches}
                  </td>
                  <td className="border-b px-3 py-2">
                    Students {log.updated_students}
                  </td>
                  <td className="border-b px-3 py-2">
                    New {log.created_enrollments} / Updated{" "}
                    {log.updated_enrollments}
                  </td>
                  <td className="border-b px-3 py-2">{log.skipped_rows}</td>
                  <td className="border-b px-3 py-2">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="border-b px-3 py-2">
                    <div className="flex flex-wrap gap-2">
  {(log.error_rows > 0 || log.skipped_rows > 0) && (
    <button
      type="button"
      onClick={() => {
        window.location.href = `/api/admin/students/bulk-import/history/${log.id}/errors/export`;
      }}
      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
    >
      Error CSV
    </button>
  )}

  {["SUCCESS", "PARTIAL_SUCCESS"].includes(log.status) && (
    <button
      type="button"
      onClick={async () => {
        const confirmed = window.confirm(
          `Rollback import #${log.id}? This will revert created/updated students, batches, and enrollments tracked under this import.`
        );

        if (!confirmed) return;

        const res = await fetch(
          `/api/admin/students/bulk-import/history/${log.id}/rollback`,
          {
            method: "POST",
          }
        );

        const json = await res.json();

        if (!res.ok) {
          alert(json.error || "Rollback failed.");
          return;
        }

        alert("Rollback completed.");
        await loadHistory();
      }}
      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
    >
      Rollback
    </button>
  )}

  {log.status === "ROLLED_BACK" && (
    <span className="text-xs font-medium text-slate-500">Rolled back</span>
  )}

  {!["SUCCESS", "PARTIAL_SUCCESS", "ROLLED_BACK"].includes(log.status) &&
    log.error_rows === 0 &&
    log.skipped_rows === 0 && (
      <span className="text-xs text-slate-400">No action</span>
    )}
</div>
                  </td>
                </tr>
              ))}

              {history.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    No student import history found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
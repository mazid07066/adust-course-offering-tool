"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type ProgramOption = {
  id: number;
  label: string;
};

type BatchOption = {
  id: number;
  program_id: number;
  batch_code: string;
};

type VerificationRow = {
  student_db_id: number;
  student_official_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  student_is_active: boolean | null;
  enrollment_id: number | null;
  program_id: number | null;
  program_label: string | null;
  batch_id: number | null;
  batch_code: string | null;
  admission_semester: string | null;
  enrollment_status: string | null;
  is_current: boolean | null;
  verification_status: string;
};

type OptionsResponse = {
  success?: boolean;
  error?: string;
  programs?: ProgramOption[];
  batches?: BatchOption[];
  statuses?: string[];
};

type ListResponse = {
  success?: boolean;
  error?: string;
  summary?: {
    totalRows: number;
    okRows: number;
    noEnrollmentRows: number;
    programMissingRows: number;
    batchMissingRows: number;
  };
  rows?: VerificationRow[];
};

type MutationResponse = {
  success?: boolean;
  error?: string;
};

export default function StudentVerificationPageClient() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");

  const [summary, setSummary] = useState<ListResponse["summary"] | null>(null);
  const [rows, setRows] = useState<VerificationRow[]>([]);

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<number | null>(
    null
  );

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editingEnrollmentId, setEditingEnrollmentId] = useState<number | null>(
    null
  );
  const [editBatchId, setEditBatchId] = useState("");
  const [editAdmissionSemester, setEditAdmissionSemester] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  const filteredBatches = useMemo(() => {
    if (!programId) return batches;
    return batches.filter((batch) => String(batch.program_id) === programId);
  }, [batches, programId]);

  async function loadOptions() {
    setLoadingOptions(true);
    setError("");

    try {
      const res = await fetch("/api/admin/students/verification/options", {
        cache: "no-store",
      });

      const json: OptionsResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load verification options.");
      }

      setPrograms(json.programs || []);
      setBatches(json.batches || []);
      setStatuses(json.statuses || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load verification options."
      );
    } finally {
      setLoadingOptions(false);
    }
  }

  async function loadRows() {
    setLoadingRows(true);
    setError("");
    setMessage("");

    try {
      const qs = new URLSearchParams();

      if (programId) qs.set("programId", programId);
      if (batchId) qs.set("batchId", batchId);
      if (status) qs.set("status", status);
      if (keyword) qs.set("keyword", keyword);

      qs.set("limit", "300");

      const res = await fetch(
        `/api/admin/students/verification/list?${qs.toString()}`,
        {
          cache: "no-store",
        }
      );

      const json: ListResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load student verification list.");
      }

      setSummary(json.summary || null);
      setRows(json.rows || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load student verification list."
      );
      setRows([]);
      setSummary(null);
    } finally {
      setLoadingRows(false);
    }
  }

  function startEdit(row: VerificationRow) {
    if (!row.enrollment_id) return;

    setEditingEnrollmentId(row.enrollment_id);
    setEditBatchId(row.batch_id ? String(row.batch_id) : "");
    setEditAdmissionSemester(row.admission_semester || "");
    setEditStatus(row.enrollment_status || "ACTIVE");
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingEnrollmentId(null);
    setEditBatchId("");
    setEditAdmissionSemester("");
    setEditStatus("ACTIVE");
  }

  async function saveEnrollmentEdit() {
    if (!editingEnrollmentId) return;

    setSavingEdit(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/admin/students/enrollments/${editingEnrollmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId: editBatchId,
            admissionSemester: editAdmissionSemester,
            enrollmentStatus: editStatus,
          }),
        }
      );

      const json: MutationResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update enrollment.");
      }

      setMessage("Enrollment updated successfully.");
      cancelEdit();
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update enrollment.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteEnrollment(enrollmentId: number) {
    const confirmed = window.confirm(
      "Delete this enrollment row? Use this only when a wrong imported enrollment needs to be removed."
    );

    if (!confirmed) return;

    setDeletingEnrollmentId(enrollmentId);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/students/enrollments/${enrollmentId}`, {
        method: "DELETE",
      });

      const json: MutationResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete enrollment.");
      }

      setMessage("Enrollment deleted successfully.");
      if (editingEnrollmentId === enrollmentId) {
        cancelEdit();
      }
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete enrollment.");
    } finally {
      setDeletingEnrollmentId(null);
    }
  }

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    if (programId && batchId) {
      const selectedBatch = batches.find((batch) => String(batch.id) === batchId);

      if (selectedBatch && String(selectedBatch.program_id) !== programId) {
        setBatchId("");
      }
    }
  }, [programId, batchId, batches]);

  function statusBadge(value: string) {
    if (value === "OK") return "bg-green-100 text-green-700";
    if (value === "NO_ENROLLMENT") return "bg-red-100 text-red-700";
    if (value === "PROGRAM_MISSING") return "bg-amber-100 text-amber-700";
    if (value === "BATCH_MISSING") return "bg-purple-100 text-purple-700";
    return "bg-slate-100 text-slate-700";
  }

  function activeBatchOptionsForRow(row: VerificationRow) {
    if (!row.program_id) return batches;
    return batches.filter((batch) => batch.program_id === row.program_id);
  }

  return (
    <AdminLayout title="Student Verification">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Student Enrollment Verification
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Verify imported students, matched programs, matched batches,
              admission semester, and enrollment status after bulk import. You can
              also correct wrong enrollment batch assignments here.
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Program
              </label>
              <select
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  setBatchId("");
                }}
                disabled={loadingOptions}
                className="w-full rounded-xl border px-4 py-3 text-sm"
              >
                <option value="">All Programs</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Batch
              </label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={loadingOptions}
                className="w-full rounded-xl border px-4 py-3 text-sm"
              >
                <option value="">All Batches</option>
                {filteredBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={loadingOptions}
                className="w-full rounded-xl border px-4 py-3 text-sm"
              >
                <option value="">All Statuses</option>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Search
              </label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="ID, name, phone, email"
                className="w-full rounded-xl border px-4 py-3 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadRows}
                disabled={loadingRows}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loadingRows ? "Loading..." : "Verify Students"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
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
              Verification Summary
            </h3>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                Total: {summary.totalRows}
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                OK: {summary.okRows}
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
                No Enrollment: {summary.noEnrollmentRows}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                Program Missing: {summary.programMissingRows}
              </span>
              <span className="rounded-full bg-purple-100 px-3 py-1 font-medium text-purple-700">
                Batch Missing: {summary.batchMissingRows}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Student ID</th>
                <th className="border-b px-3 py-3 text-left">Name</th>
                <th className="border-b px-3 py-3 text-left">Program</th>
                <th className="border-b px-3 py-3 text-left">Batch</th>
                <th className="border-b px-3 py-3 text-left">
                  Admission Semester
                </th>
                <th className="border-b px-3 py-3 text-left">Enrollment</th>
                <th className="border-b px-3 py-3 text-left">Current</th>
                <th className="border-b px-3 py-3 text-left">Phone</th>
                <th className="border-b px-3 py-3 text-left">Email</th>
                <th className="border-b px-3 py-3 text-left">Verification</th>
                <th className="border-b px-3 py-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const isEditing =
                  row.enrollment_id !== null &&
                  editingEnrollmentId === row.enrollment_id;

                return (
                  <tr key={`${row.student_db_id}-${row.enrollment_id || "none"}`}>
                    <td className="border-b px-3 py-2 font-medium">
                      {row.student_official_id}
                    </td>

                    <td className="border-b px-3 py-2">{row.full_name}</td>

                    <td className="border-b px-3 py-2">
                      {row.program_label || "-"}
                    </td>

                    <td className="border-b px-3 py-2">{row.batch_code || "-"}</td>

                    <td className="border-b px-3 py-2">
                      {row.admission_semester || "-"}
                    </td>

                    <td className="border-b px-3 py-2">
                      {row.enrollment_status || "-"}
                    </td>

                    <td className="border-b px-3 py-2">
                      {row.is_current === null
                        ? "-"
                        : row.is_current
                          ? "Yes"
                          : "No"}
                    </td>

                    <td className="border-b px-3 py-2">{row.phone || "-"}</td>

                    <td className="border-b px-3 py-2">{row.email || "-"}</td>

                    <td className="border-b px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(
                          row.verification_status
                        )}`}
                      >
                        {row.verification_status}
                      </span>
                    </td>

                    <td className="border-b px-3 py-2">
                      {row.enrollment_id ? (
                        <div className="min-w-[220px] space-y-2">
                          {isEditing ? (
                            <div className="space-y-2">
                              <select
                                value={editBatchId}
                                onChange={(e) => setEditBatchId(e.target.value)}
                                className="w-full rounded-lg border px-2 py-1 text-xs"
                              >
                                <option value="">No Batch</option>
                                {activeBatchOptionsForRow(row).map((batch) => (
                                  <option key={batch.id} value={batch.id}>
                                    {batch.batch_code}
                                  </option>
                                ))}
                              </select>

                              <input
                                value={editAdmissionSemester}
                                onChange={(e) =>
                                  setEditAdmissionSemester(e.target.value)
                                }
                                placeholder="Admission Semester"
                                className="w-full rounded-lg border px-2 py-1 text-xs"
                              />

                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                                className="w-full rounded-lg border px-2 py-1 text-xs"
                              >
                                {statuses.length > 0 ? (
                                  statuses.map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))
                                ) : (
                                  <option value="ACTIVE">ACTIVE</option>
                                )}
                              </select>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={saveEnrollmentEdit}
                                  disabled={savingEdit}
                                  className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  {savingEdit ? "Saving..." : "Save"}
                                </button>

                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={savingEdit}
                                  className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  row.enrollment_id &&
                                  deleteEnrollment(row.enrollment_id)
                                }
                                disabled={deletingEnrollmentId === row.enrollment_id}
                                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                {deletingEnrollmentId === row.enrollment_id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          No enrollment
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    Select filters and click Verify Students.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
          <h3 className="font-semibold">Correction guideline</h3>
          <p className="mt-2">
            For a small mistake, such as one student being assigned to batch 232
            instead of 231, use the Edit button in this table. For a large file-level
            mistake, use Student Bulk Import History and roll back the full import,
            then upload the corrected CSV/XLSX again.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
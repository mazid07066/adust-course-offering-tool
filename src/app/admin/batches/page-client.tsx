"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";

type BatchRow = {
  id: number;
  programId: number;
  programCode: string;
  programName: string;
  batchCode: string;
  admissionTerm: string;
  active: boolean;
};

type BatchApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  batches?: BatchRow[];
};

export default function BatchesPageClient() {
  const {
    programs,
    programCode,
    setProgramCode,
    loadingPrograms,
    programError,
  } = useAcademicCatalogPrograms();

  const [batchCode, setBatchCode] = useState("");
  const [admissionTerm, setAdmissionTerm] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [rows, setRows] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAdmissionTerm, setEditAdmissionTerm] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRows() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/batches/manage", {
        method: "GET",
        cache: "no-store",
      });

      const json: BatchApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load batches.");
      }

      setRows(json.batches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    if (!programCode) return rows;
    return rows.filter((row) => row.programCode === programCode);
  }, [rows, programCode]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/batches/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programCode,
          batchCode,
          admissionTerm,
          isActive,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create batch.");
      }

      setMessage(
        json.resolvedProgram?.requestedProgramCode &&
          json.resolvedProgram?.actualProgramCode &&
          json.resolvedProgram.requestedProgramCode !==
            json.resolvedProgram.actualProgramCode
          ? `Batch created successfully under resolved program ${json.resolvedProgram.actualProgramCode}.`
          : json.message || "Batch created successfully."
      );

      setBatchCode("");
      setAdmissionTerm("");
      setIsActive(true);

      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create batch.");
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(row: BatchRow) {
    setEditingId(row.id);
    setEditAdmissionTerm(row.admissionTerm || "");
    setEditIsActive(row.active);
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAdmissionTerm("");
    setEditIsActive(true);
  }

  async function saveEdit(id: number) {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/batches/manage/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          admissionTerm: editAdmissionTerm,
          isActive: editIsActive,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update batch.");
      }

      setMessage(json.message || "Batch updated successfully.");
      cancelEdit();
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update batch.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBatch(id: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this batch? Completed/ongoing imported records for this batch will also be removed."
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/batches/manage/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete batch.");
      }

      setMessage(json.message || "Batch deleted successfully.");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete batch.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Batches">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Create Batch</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a batch under a selected academic identity. If the exact program is
            not present in the programs table, the system will safely resolve to the
            canonical target program.
          </p>

          <form
            onSubmit={handleCreate}
            className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Program / Curriculum
              </label>
              <select
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                disabled={loadingPrograms}
              >
                <option value="">
                  {loadingPrograms ? "Loading programs..." : "Select program / curriculum"}
                </option>
                {programs.map((program) => (
                  <option key={program.programCode} value={program.programCode}>
                    {program.displayLabel}
                  </option>
                ))}
              </select>
              {programError ? (
                <p className="mt-2 text-sm text-red-600">{programError}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Batch Code
              </label>
              <input
                type="text"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value.toUpperCase())}
                placeholder="Example: 262"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Admission Term
              </label>
              <input
                type="text"
                value={admissionTerm}
                onChange={(e) => setAdmissionTerm(e.target.value.toUpperCase())}
                placeholder="Example: SUMMER 2026"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="batch-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="batch-active" className="text-sm text-slate-700">
                Active
              </label>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting || !programCode || !batchCode}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create Batch"}
              </button>
            </div>
          </form>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Batch Records</h2>
              <p className="mt-1 text-sm text-slate-600">
                Total: {filteredRows.length}
              </p>
            </div>

            <div className="w-full max-w-md">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Filter by Program / Curriculum
              </label>
              <select
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
              >
                <option value="">All programs</option>
                {programs.map((program) => (
                  <option key={program.programCode} value={program.programCode}>
                    {program.displayLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">
                    Batch Code
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">
                    Program
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">
                    Admission Term
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Loading batches...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No batch records found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.batchCode}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{row.programCode}</div>
                        <div className="text-xs text-slate-500">{row.programName}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {editingId === row.id ? (
                          <input
                            type="text"
                            value={editAdmissionTerm}
                            onChange={(e) =>
                              setEditAdmissionTerm(e.target.value.toUpperCase())
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                          />
                        ) : (
                          row.admissionTerm || "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {editingId === row.id ? (
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editIsActive}
                              onChange={(e) => setEditIsActive(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span>{editIsActive ? "Active" : "Inactive"}</span>
                          </label>
                        ) : row.active ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex flex-wrap gap-2">
                          {editingId === row.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEdit(row.id)}
                                disabled={submitting}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={submitting}
                                className="rounded-lg bg-slate-500 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => beginEdit(row)}
                                className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteBatch(row.id)}
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramBatchSelector from "@/components/program-batch-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useProgramBatches } from "@/hooks/use-program-batches";

type StatusRow = {
  code: string;
  title: string;
  credit: number;
  type: string;
  category: string;
  status: string;
};

type StatusResponse = {
  success?: boolean;
  error?: string;
  summary?: {
    total: number;
    completed: number;
    ongoing: number;
    remaining: number;
  };
  rows?: StatusRow[];
};

export default function BatchStatusPageClient() {
  const {
    programs,
    programCode,
    setProgramCode,
    loadingPrograms,
    programError,
  } = useAcademicCatalogPrograms();

  const {
    batches,
    batchCode,
    setBatchCode,
    loadingBatches,
    batchError,
  } = useProgramBatches(programCode);

  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<StatusResponse["summary"] | null>(null);
  const [rows, setRows] = useState<StatusRow[]>([]);

  async function loadStatus(e: React.FormEvent) {
    e.preventDefault();

    setLoadingStatus(true);
    setError("");

    try {
      const res = await fetch(
        `/api/batch-status?programCode=${encodeURIComponent(
          programCode
        )}&batchCode=${encodeURIComponent(batchCode)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json: StatusResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load batch status.");
      }

      setSummary(json.summary || null);
      setRows(json.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch status.");
    } finally {
      setLoadingStatus(false);
    }
  }

  const combinedError = error || programError || batchError;

  return (
    <AdminLayout title="Batch Academic Status">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Batch-wise completion overview
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            View completed, ongoing, and remaining courses for a selected batch.
          </p>
        </div>

        <form onSubmit={loadStatus} className="space-y-4">
          <ProgramBatchSelector
            programs={programs}
            programCode={programCode}
            setProgramCode={setProgramCode}
            loadingPrograms={loadingPrograms}
            batches={batches}
            batchCode={batchCode}
            setBatchCode={setBatchCode}
            loadingBatches={loadingBatches}
            showBatch={true}
          />

          <button
            type="submit"
            disabled={loadingStatus || !programCode || !batchCode}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loadingStatus ? "Loading..." : "Load Status"}
          </button>
        </form>

        {combinedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        )}

        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total Courses</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.total}</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <p className="text-sm text-green-700">Completed</p>
              <p className="mt-2 text-2xl font-semibold text-green-900">{summary.completed}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-sm text-amber-700">Ongoing</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">{summary.ongoing}</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
              <p className="text-sm text-red-700">Remaining</p>
              <p className="mt-2 text-2xl font-semibold text-red-900">{summary.remaining}</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Code</th>
                <th className="border-b px-3 py-3 text-left">Title</th>
                <th className="border-b px-3 py-3 text-left">Credit</th>
                <th className="border-b px-3 py-3 text-left">Type</th>
                <th className="border-b px-3 py-3 text-left">Category</th>
                <th className="border-b px-3 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.code}-${idx}`}>
                  <td className="border-b px-3 py-2">{row.code}</td>
                  <td className="border-b px-3 py-2">{row.title}</td>
                  <td className="border-b px-3 py-2">{row.credit}</td>
                  <td className="border-b px-3 py-2">{row.type}</td>
                  <td className="border-b px-3 py-2">{row.category}</td>
                  <td className="border-b px-3 py-2">{row.status}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No status data loaded yet.
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
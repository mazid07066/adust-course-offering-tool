"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramBatchSelector from "@/components/program-batch-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useProgramBatches } from "@/hooks/use-program-batches";

type CleanupSummary = {
  programCode: string;
  batchCode: string;
  completedCount: number;
  ongoingCount: number;
};

export default function BatchStatusCleanupPageClient() {
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

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<CleanupSummary | null>(null);

  async function loadSummary(e: React.FormEvent) {
    e.preventDefault();

    setLoadingSummary(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/batch-status-cleanup?programCode=${encodeURIComponent(
          programCode
        )}&batchCode=${encodeURIComponent(batchCode)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load cleanup summary.");
      }

      setSummary(json.summary || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load cleanup summary."
      );
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      `Delete imported batch status for ${programCode} / ${batchCode}?`
    );
    if (!ok) return;

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/batch-status-cleanup", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programCode,
          batchCode,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to clean imported status.");
      }

      setMessage(json.message || "Imported status cleaned successfully.");
      setSummary(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clean imported status."
      );
    } finally {
      setDeleting(false);
    }
  }

  const combinedError = error || programError || batchError;

  return (
    <AdminLayout title="Batch Status Cleanup">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Cleanup imported batch status
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Select program and batch from dropdowns only.
          </p>
        </div>

        <form onSubmit={loadSummary} className="space-y-4">
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
            disabled={loadingSummary || !programCode || !batchCode}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loadingSummary ? "Loading..." : "Load Cleanup Summary"}
          </button>
        </form>

        {combinedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {summary && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="text-sm text-green-700">Completed Records</p>
                <p className="mt-2 text-2xl font-semibold text-green-900">
                  {summary.completedCount}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm text-amber-700">Ongoing Records</p>
                <p className="mt-2 text-2xl font-semibold text-amber-900">
                  {summary.ongoingCount}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete Imported Status"}
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
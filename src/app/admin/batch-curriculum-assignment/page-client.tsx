"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramBatchSelector from "@/components/program-batch-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useProgramBatches } from "@/hooks/use-program-batches";

type CandidateTarget = {
  programId: number;
  programCode: string;
  programName: string;
  alreadyHasSameBatchCode: boolean;
  existingBatchId: number | null;
};

type SummaryResponse = {
  success?: boolean;
  error?: string;
  source?: {
    batchId: number;
    batchCode: string;
    admissionTerm: string | null;
    programCode: string;
    programName: string;
  };
  summary?: {
    completedCount: number;
    currentCount: number;
    offeringUsageCount: number;
  };
  candidateTargets?: CandidateTarget[];
};

type AssignResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  result?: {
    batchCode: string;
    sourceProgramCode: string;
    targetProgramCode: string;
    finalBatchId: number;
    mergedIntoExisting: boolean;
    completedCount: number;
    currentCount: number;
  };
};

export default function BatchCurriculumAssignmentPageClient() {
  const {
    programs,
    programCode: sourceProgramCode,
    setProgramCode: setSourceProgramCode,
    loadingPrograms,
    programError,
  } = useAcademicCatalogPrograms();

  const {
    batches,
    batchCode,
    setBatchCode,
    loadingBatches,
    batchError,
  } = useProgramBatches(sourceProgramCode);

  const [targetProgramCode, setTargetProgramCode] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  async function handleLoadSummary(e: React.FormEvent) {
    e.preventDefault();

    setLoadingSummary(true);
    setError("");
    setMessage("");
    setSummary(null);

    try {
      const res = await fetch(
        `/api/batch-curriculum-assignment?sourceProgramCode=${encodeURIComponent(
          sourceProgramCode
        )}&batchCode=${encodeURIComponent(batchCode)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json: SummaryResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load assignment summary.");
      }

      setSummary(json);

      const validTargets = (json.candidateTargets || []).filter(
        (t) => t.programCode !== sourceProgramCode
      );

      if (validTargets.length > 0) {
        setTargetProgramCode(validTargets[0].programCode);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load assignment summary."
      );
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleAssign() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (!sourceProgramCode || !targetProgramCode || !batchCode) {
        throw new Error("Source program, target program, and batch are required.");
      }

      const confirmed = window.confirm(
        `Assign batch ${batchCode} from ${sourceProgramCode} to ${targetProgramCode}?`
      );

      if (!confirmed) {
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/batch-curriculum-assignment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceProgramCode,
          targetProgramCode,
          batchCode,
        }),
      });

      const json: AssignResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to assign batch program/curriculum.");
      }

      setMessage(json.message || "Batch program/curriculum assigned successfully.");
      setSummary(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to assign batch program/curriculum."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const targetOptions =
    summary?.candidateTargets?.filter((t) => t.programCode !== sourceProgramCode) || [];

  const combinedError = error || programError || batchError;

  return (
    <AdminLayout title="Batch Curriculum Assignment">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Assign a batch to a specific program and curriculum
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            All batch and program selections come from dropdowns only.
          </p>
        </div>

        <form onSubmit={handleLoadSummary} className="space-y-4">
          <ProgramBatchSelector
            programs={programs}
            programCode={sourceProgramCode}
            setProgramCode={setSourceProgramCode}
            loadingPrograms={loadingPrograms}
            batches={batches}
            batchCode={batchCode}
            setBatchCode={setBatchCode}
            loadingBatches={loadingBatches}
            showBatch={true}
          />

          <button
            type="submit"
            disabled={loadingSummary || !sourceProgramCode || !batchCode}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loadingSummary ? "Loading..." : "Load Batch Summary"}
          </button>
        </form>

        {combinedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        )}

        {summary?.source && summary?.summary && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Completed Records</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {summary.summary.completedCount}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Current Records</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {summary.summary.currentCount}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Offering Usage</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {summary.summary.offeringUsageCount}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="mb-4 text-base font-semibold text-slate-900">
                Choose exact target program / curriculum
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Target Program / Curriculum
                  </label>
                  <select
                    value={targetProgramCode}
                    onChange={(e) => setTargetProgramCode(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3"
                  >
                    {targetOptions.map((t) => (
                      <option key={t.programId} value={t.programCode}>
                        {t.programCode} — {t.programName}
                        {t.alreadyHasSameBatchCode ? " [same batch already exists]" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={
                      submitting ||
                      !sourceProgramCode ||
                      !targetProgramCode ||
                      !batchCode
                    }
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submitting ? "Assigning..." : "Assign Program / Curriculum"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
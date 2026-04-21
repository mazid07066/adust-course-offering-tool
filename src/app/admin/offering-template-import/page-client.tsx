"use client";

import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramTermSelector from "@/components/program-term-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type PreviewRow = {
  rowKey: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  batchHeaderText: string;
  batchCode: string;
  serialNo: string;
  courseTitle: string;
  courseCode: string;
  coofferedCourseCode: string;
  facultyInitial: string;
  section: string;
  credits: number;
  day: string;
  rawTime: string;
  startTime: string;
  endTime: string;
  timeParseOk: boolean;
  timeParseReason: string;
  tentativeEnrollment: string;
  room: string;
  courseType: string;
  status: "READY" | "WARNING" | "BLOCKED";
  issues: string[];
};

type PreviewResponse = {
  ok?: boolean;
  error?: string;
  fileName?: string;
  programCode?: string;
  termName?: string;
  sheetName?: string;
  summary?: {
    totalRows: number;
    totalBatchBlocks: number;
    detectedBatchCodes: string[];
    readyCount: number;
    warningCount: number;
    blockedCount: number;
  };
  previewRows?: PreviewRow[];
};

type CommitResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  draftId?: number;
  summary?: {
    importedRowCount: number;
    createdCourseCount: number;
    reusedCourseCount: number;
    attachedBatchCount: number;
    addedTeacherCount: number;
    addedSlotCount: number;
    addedManualCoofferCount: number;
    skippedCount: number;
  };
  skippedRows?: string[];
};

export default function OfferingTemplateImportPageClient() {
  const {
    programs,
    programCode,
    setProgramCode,
    loadingPrograms,
    programError,
  } = useAcademicCatalogPrograms();

  const {
    terms,
    termName,
    setTermName,
    loadingTerms,
    termError,
  } = useAcademicTerms();

  const [file, setFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewResponse["summary"] | null>(null);
  const [sheetName, setSheetName] = useState("");

  const combinedError = error || programError || termError;

  const readyRows = useMemo(
    () => previewRows.filter((row) => row.status === "READY"),
    [previewRows]
  );

  const warningRows = useMemo(
    () => previewRows.filter((row) => row.status === "WARNING"),
    [previewRows]
  );

  const blockedRows = useMemo(
    () => previewRows.filter((row) => row.status === "BLOCKED"),
    [previewRows]
  );

  async function previewTemplate(e: React.FormEvent) {
    e.preventDefault();

    if (!programCode || !termName) {
      setError("Please select academic identity and term.");
      setMessage("");
      return;
    }

    if (!file) {
      setError("Please choose an Excel file.");
      setMessage("");
      return;
    }

    setPreviewLoading(true);
    setError("");
    setMessage("");
    setPreviewRows([]);
    setPreviewSummary(null);
    setSheetName("");

    try {
      const formData = new FormData();
      formData.append("programCode", programCode);
      formData.append("termName", termName);
      formData.append("file", file);

      const res = await fetch("/api/offering-template-import/preview", {
        method: "POST",
        body: formData,
      });

      const json: PreviewResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to preview offering template.");
      }

      setPreviewRows(json.previewRows || []);
      setPreviewSummary(json.summary || null);
      setSheetName(json.sheetName || "");
      setMessage("Template preview loaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to preview offering template."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function commitImport() {
    if (!programCode || !termName) {
      setError("Please select academic identity and term.");
      setMessage("");
      return;
    }

    if (previewRows.length === 0) {
      setError("Preview the file first.");
      setMessage("");
      return;
    }

    const ok = window.confirm(
      "Import all READY and WARNING rows into the selected draft offering?"
    );
    if (!ok) return;

    setCommitLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/offering-template-import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programCode,
          termName,
          rows: previewRows,
        }),
      });

      const json: CommitResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to import template into draft.");
      }

      setMessage(
        `${json.message || "Import complete."} Draft ID: ${json.draftId ?? "-"}`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import template into draft."
      );
    } finally {
      setCommitLoading(false);
    }
  }

  return (
    <AdminLayout title="Offering Template Import">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Offering Template Import
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Upload a prepared Excel offering file for a selected academic identity.
            The system will preview batch-wise rows, detect issues, and then import
            the usable rows into a draft offering.
          </p>
        </div>

        <form onSubmit={previewTemplate} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ProgramTermSelector
            programs={programs}
            programCode={programCode}
            setProgramCode={setProgramCode}
            loadingPrograms={loadingPrograms}
            terms={terms}
            termName={termName}
            setTermName={setTermName}
            loadingTerms={loadingTerms}
          />

          <div className="max-w-xl">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Excel Template File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full rounded-xl border px-4 py-3 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={previewLoading || !programCode || !termName || !file}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {previewLoading ? "Previewing..." : "Preview Template"}
            </button>

            <button
              type="button"
              onClick={commitImport}
              disabled={commitLoading || previewRows.length === 0}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {commitLoading ? "Importing..." : "Import Into Draft"}
            </button>
          </div>
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

        {previewSummary && (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sheet
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900">{sheetName || "-"}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Batch Blocks
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900">
                {previewSummary.totalBatchBlocks}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ready / Warning
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900">
                {previewSummary.readyCount} / {previewSummary.warningCount}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Blocked
              </div>
              <div className="mt-2 text-lg font-bold text-red-700">
                {previewSummary.blockedCount}
              </div>
            </div>
          </div>
        )}

        {previewRows.length > 0 && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-base font-semibold text-slate-900">
                Preview Summary
              </h4>
              <div className="mt-3 text-sm text-slate-600">
                Detected batches: {previewSummary?.detectedBatchCodes.join(", ") || "-"}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Rows to import now: {readyRows.length + warningRows.length}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-base font-semibold text-slate-900">Preview Rows</h4>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border-b px-3 py-3 text-left">Status</th>
                      <th className="border-b px-3 py-3 text-left">Batch</th>
                      <th className="border-b px-3 py-3 text-left">Course</th>
                      <th className="border-b px-3 py-3 text-left">Co-offered</th>
                      <th className="border-b px-3 py-3 text-left">Faculty</th>
                      <th className="border-b px-3 py-3 text-left">Section</th>
                      <th className="border-b px-3 py-3 text-left">Day</th>
                      <th className="border-b px-3 py-3 text-left">Time</th>
                      <th className="border-b px-3 py-3 text-left">Room</th>
                      <th className="border-b px-3 py-3 text-left">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.rowKey}>
                        <td className="border-b px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              row.status === "READY"
                                ? "bg-emerald-100 text-emerald-700"
                                : row.status === "WARNING"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="border-b px-3 py-2">{row.batchCode}</td>
                        <td className="border-b px-3 py-2">
                          <div className="font-medium text-slate-900">{row.courseCode}</div>
                          <div className="text-slate-500">{row.courseTitle}</div>
                        </td>
                        <td className="border-b px-3 py-2">{row.coofferedCourseCode || "-"}</td>
                        <td className="border-b px-3 py-2">{row.facultyInitial || "-"}</td>
                        <td className="border-b px-3 py-2">{row.section}</td>
                        <td className="border-b px-3 py-2">{row.day || "-"}</td>
                        <td className="border-b px-3 py-2">{row.rawTime || "-"}</td>
                        <td className="border-b px-3 py-2">{row.room || "-"}</td>
                        <td className="border-b px-3 py-2">
                          {row.issues.length > 0 ? row.issues.join(" | ") : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
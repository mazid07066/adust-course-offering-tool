"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicTerms } from "@/hooks/use-academic-terms";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useProgramBatches } from "@/hooks/use-program-batches";

type ScheduleRow = {
  offeredCourseId: number;
  programCode: string;
  programName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  credit: number;
  role: string;
  primaryReference: string;
  batchCodes: string[];
  facultyText: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  summary?: {
    totalRows: number;
    rowsWithRoom: number;
    rowsWithoutRoom: number;
    rowsWithFaculty: number;
    rowsWithoutFaculty: number;
  };
  rows?: ScheduleRow[];
};

export default function ConfirmedSchedulePageClient() {
  const { terms, termName, setTermName, loadingTerms, termError } = useAcademicTerms();
  const {
    programs,
    programCode,
    setProgramCode,
    loadingPrograms,
    programError,
  } = useAcademicCatalogPrograms();

  const [scope, setScope] = useState<"COMBINED" | "PROGRAM" | "BATCH">("COMBINED");
  const effectiveProgramCode = scope === "COMBINED" ? "" : programCode;
  const { batches, batchCode, setBatchCode, loadingBatches, batchError } =
    useProgramBatches(effectiveProgramCode);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [summary, setSummary] = useState<ApiResponse["summary"] | null>(null);

  async function loadReport() {
    if (!termName) return;

    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams();
      qs.set("termName", termName);
      if (scope === "PROGRAM" || scope === "BATCH") qs.set("programCode", programCode);
      if (scope === "BATCH") qs.set("batchCode", batchCode);

      const res = await fetch(`/api/admin/reports/confirmed-schedule?${qs.toString()}`, {
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load confirmed schedule.");
      }

      setRows(json.rows || []);
      setSummary(json.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load confirmed schedule.");
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (termName) loadReport();
  }, [termName, scope, programCode, batchCode]);

  const exportQuery = new URLSearchParams();
  exportQuery.set("termName", termName || "");
  if (scope === "PROGRAM" || scope === "BATCH") exportQuery.set("programCode", programCode || "");
  if (scope === "BATCH") exportQuery.set("batchCode", batchCode || "");

  const combinedError = error || termError || programError || batchError;

  return (
    <AdminLayout title="Confirmed Schedule">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Academic Term</label>
              <select value={termName} onChange={(e) => setTermName(e.target.value)} className="w-full rounded-xl border px-4 py-3" disabled={loadingTerms}>
                <option value="">{loadingTerms ? "Loading terms..." : "Select Academic Term"}</option>
                {terms.map((term) => <option key={term.name} value={term.name}>{term.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Report Scope</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as "COMBINED" | "PROGRAM" | "BATCH")} className="w-full rounded-xl border px-4 py-3">
                <option value="COMBINED">Combined All Programs</option>
                <option value="PROGRAM">Program-wise</option>
                <option value="BATCH">Batch-wise under Program</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Program</label>
              <select value={programCode} onChange={(e) => setProgramCode(e.target.value)} className="w-full rounded-xl border px-4 py-3" disabled={scope === "COMBINED" || loadingPrograms}>
                {programs.map((program) => (
                  <option key={program.programCode} value={program.programCode}>
                    {program.displayLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Batch</label>
              <select value={batchCode} onChange={(e) => setBatchCode(e.target.value)} className="w-full rounded-xl border px-4 py-3" disabled={scope !== "BATCH" || loadingBatches}>
                {batches.map((batch) => (
                  <option key={batch.batchCode} value={batch.batchCode}>
                    {batch.batchCode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={loadReport} disabled={!termName || loading} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
              {loading ? "Loading..." : "Refresh Schedule"}
            </button>

            <a href={`/api/export/confirmed-schedule?${exportQuery.toString()}`} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700">
              Download Schedule CSV
            </a>
          </div>
        </div>

        {combinedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        )}

        {summary && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">Total Rows: {summary.totalRows}</span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">With Room: {summary.rowsWithRoom}</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">Without Room: {summary.rowsWithoutRoom}</span>
              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">With Faculty: {summary.rowsWithFaculty}</span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">Without Faculty: {summary.rowsWithoutFaculty}</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Day</th>
                <th className="border-b px-3 py-3 text-left">Time</th>
                <th className="border-b px-3 py-3 text-left">Room</th>
                <th className="border-b px-3 py-3 text-left">Program</th>
                <th className="border-b px-3 py-3 text-left">Course</th>
                <th className="border-b px-3 py-3 text-left">Section</th>
                <th className="border-b px-3 py-3 text-left">Role</th>
                <th className="border-b px-3 py-3 text-left">Batches</th>
                <th className="border-b px-3 py-3 text-left">Faculty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.offeredCourseId}-${row.dayOfWeek}-${row.startTime}-${index}`}>
                  <td className="border-b px-3 py-2">{row.dayOfWeek}</td>
                  <td className="border-b px-3 py-2">{row.startTime} - {row.endTime}</td>
                  <td className="border-b px-3 py-2">{row.roomCode}</td>
                  <td className="border-b px-3 py-2">{row.programCode}</td>
                  <td className="border-b px-3 py-2">{row.courseCode} — {row.courseTitle}</td>
                  <td className="border-b px-3 py-2">{row.section}</td>
                  <td className="border-b px-3 py-2">{row.role}</td>
                  <td className="border-b px-3 py-2">{row.batchCodes.join(", ") || "-"}</td>
                  <td className="border-b px-3 py-2">{row.facultyText}</td>
                </tr>
              ))}

              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No report rows found for the selected filter.
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
"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type RoutineRow = {
  batchCode: string;
  programCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  facultyText: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  role: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  batchOptions?: string[];
  summary?: {
    totalRows: number;
    totalBatches: number;
  };
  rows?: RoutineRow[];
};

export default function BatchRoutinePageClient() {
  const { terms, termName, setTermName, loadingTerms, termError } = useAcademicTerms();

  const [batchCode, setBatchCode] = useState("");
  const [batchOptions, setBatchOptions] = useState<string[]>([]);
  const [rows, setRows] = useState<RoutineRow[]>([]);
  const [summary, setSummary] = useState<ApiResponse["summary"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReport(selectedBatchCode?: string) {
    if (!termName) return;

    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams();
      qs.set("termName", termName);
      if (selectedBatchCode || batchCode) {
        qs.set("batchCode", selectedBatchCode || batchCode);
      }

      const res = await fetch(`/api/admin/reports/batch-routine?${qs.toString()}`, {
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load batch routine report.");
      }

      setBatchOptions(json.batchOptions || []);
      setRows(json.rows || []);
      setSummary(json.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch routine report.");
      setBatchOptions([]);
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (termName) {
      setBatchCode("");
      loadReport("");
    }
  }, [termName]);

  return (
    <AdminLayout title="Batch Routine Report">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
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

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Batch Code
              </label>
              <select
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">All Batches</option>
                {batchOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={() => loadReport()}
                disabled={!termName || loading}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? "Loading..." : "Refresh Batch Routine"}
              </button>

              <a
                href={`/api/export/batch-routine?termName=${encodeURIComponent(termName || "")}&batchCode=${encodeURIComponent(batchCode || "")}`}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Download CSV
              </a>
            </div>
          </div>
        </div>

        {(error || termError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || termError}
          </div>
        )}

        {summary && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                Total Rows: {summary.totalRows}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                Total Batches: {summary.totalBatches}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Batch</th>
                <th className="border-b px-3 py-3 text-left">Day</th>
                <th className="border-b px-3 py-3 text-left">Time</th>
                <th className="border-b px-3 py-3 text-left">Room</th>
                <th className="border-b px-3 py-3 text-left">Program</th>
                <th className="border-b px-3 py-3 text-left">Course</th>
                <th className="border-b px-3 py-3 text-left">Section</th>
                <th className="border-b px-3 py-3 text-left">Role</th>
                <th className="border-b px-3 py-3 text-left">Faculty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.batchCode}-${row.courseCode}-${row.section}-${row.dayOfWeek}-${row.startTime}-${index}`}
                >
                  <td className="border-b px-3 py-2">{row.batchCode}</td>
                  <td className="border-b px-3 py-2">{row.dayOfWeek}</td>
                  <td className="border-b px-3 py-2">
                    {row.startTime} - {row.endTime}
                  </td>
                  <td className="border-b px-3 py-2">{row.roomCode}</td>
                  <td className="border-b px-3 py-2">{row.programCode}</td>
                  <td className="border-b px-3 py-2">
                    {row.courseCode} — {row.courseTitle}
                  </td>
                  <td className="border-b px-3 py-2">{row.section}</td>
                  <td className="border-b px-3 py-2">{row.role}</td>
                  <td className="border-b px-3 py-2">{row.facultyText}</td>
                </tr>
              ))}

              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No confirmed batch routine rows found.
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
"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type ReportRow = {
  offeredCourseId: number;
  offeringId: number;
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
  assignedFacultyCount: number;
  scheduleText: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  termName?: string;
  summary?: {
    totalRows: number;
    primaryRows: number;
    secondaryRows: number;
    rowsWithFaculty: number;
    rowsWithoutFaculty: number;
  };
  rows?: ReportRow[];
};

export default function OfferingReportsPageClient() {
  const { terms, termName, setTermName, loadingTerms, termError } = useAcademicTerms();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<ApiResponse["summary"] | null>(null);

  async function loadReport() {
    if (!termName) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/reports/confirmed-offerings?termName=${encodeURIComponent(termName)}`,
        {
          cache: "no-store",
        }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load confirmed offering report.");
      }

      setRows(json.rows || []);
      setSummary(json.summary || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load confirmed offering report."
      );
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (termName) {
      loadReport();
    }
  }, [termName]);

  return (
    <AdminLayout title="Confirmed Offering Reports">
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

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadReport}
                disabled={!termName || loading}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? "Loading..." : "Refresh Report"}
              </button>

              <a
                href={`/api/export/confirmed-offering?termName=${encodeURIComponent(termName || "")}`}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Download Confirmed Offering CSV
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
            <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                Total Rows: {summary.totalRows}
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                Primary: {summary.primaryRows}
              </span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
                Secondary: {summary.secondaryRows}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                With Faculty: {summary.rowsWithFaculty}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                Without Faculty: {summary.rowsWithoutFaculty}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Program</th>
                <th className="border-b px-3 py-3 text-left">Course</th>
                <th className="border-b px-3 py-3 text-left">Section</th>
                <th className="border-b px-3 py-3 text-left">Credit</th>
                <th className="border-b px-3 py-3 text-left">Role</th>
                <th className="border-b px-3 py-3 text-left">Primary Reference</th>
                <th className="border-b px-3 py-3 text-left">Batches</th>
                <th className="border-b px-3 py-3 text-left">Assigned Faculty</th>
                <th className="border-b px-3 py-3 text-left">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.offeredCourseId}>
                  <td className="border-b px-3 py-2">{row.programCode}</td>
                  <td className="border-b px-3 py-2">
                    {row.courseCode} — {row.courseTitle}
                  </td>
                  <td className="border-b px-3 py-2">{row.section}</td>
                  <td className="border-b px-3 py-2">{row.credit}</td>
                  <td className="border-b px-3 py-2">{row.role}</td>
                  <td className="border-b px-3 py-2">{row.primaryReference}</td>
                  <td className="border-b px-3 py-2">
                    {row.batchCodes.join(", ") || "-"}
                  </td>
                  <td className="border-b px-3 py-2">{row.facultyText}</td>
                  <td className="border-b px-3 py-2">{row.scheduleText}</td>
                </tr>
              ))}

              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No confirmed offering rows found for the selected term.
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
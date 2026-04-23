"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type ProgramRow = {
  programCode: string;
  programName: string;
  totalSections: number;
  totalCourses: number;
  totalCredits: number;
  totalBatchesCovered: number;
  totalFacultyAssigned: number;
  theorySections: number;
  labSections: number;
  projectSections: number;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  overall?: {
    totalPrograms: number;
    totalSections: number;
    totalCourses: number;
    totalCredits: number;
    totalBatchesCovered: number;
    totalFacultyAssigned: number;
    theorySections: number;
    labSections: number;
    projectSections: number;
  };
  programRows?: ProgramRow[];
};

export default function OfferingSummaryPageClient() {
  const { terms, termName, setTermName, loadingTerms, termError } = useAcademicTerms();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overall, setOverall] = useState<ApiResponse["overall"] | null>(null);
  const [programRows, setProgramRows] = useState<ProgramRow[]>([]);

  async function loadSummary() {
    if (!termName) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/reports/offering-summary?termName=${encodeURIComponent(termName)}`,
        { cache: "no-store" }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load offering summary.");
      }

      setOverall(json.overall || null);
      setProgramRows(json.programRows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offering summary.");
      setOverall(null);
      setProgramRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (termName) {
      loadSummary();
    }
  }, [termName]);

  return (
    <AdminLayout title="Offering Summary Report">
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

            <button
              type="button"
              onClick={loadSummary}
              disabled={!termName || loading}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh Summary"}
            </button>
          </div>
        </div>

        {(error || termError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || termError}
          </div>
        )}

        {overall && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Programs</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {overall.totalPrograms}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Sections</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {overall.totalSections}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Credits</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {overall.totalCredits}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">Faculty Assigned</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {overall.totalFacultyAssigned}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Program</th>
                <th className="border-b px-3 py-3 text-left">Sections</th>
                <th className="border-b px-3 py-3 text-left">Courses</th>
                <th className="border-b px-3 py-3 text-left">Credits</th>
                <th className="border-b px-3 py-3 text-left">Batches Covered</th>
                <th className="border-b px-3 py-3 text-left">Faculty Assigned</th>
                <th className="border-b px-3 py-3 text-left">Theory</th>
                <th className="border-b px-3 py-3 text-left">Lab</th>
                <th className="border-b px-3 py-3 text-left">Project</th>
              </tr>
            </thead>
            <tbody>
              {programRows.map((row) => (
                <tr key={row.programCode}>
                  <td className="border-b px-3 py-2">
                    <div className="font-medium">{row.programCode}</div>
                    <div className="text-xs text-slate-500">{row.programName}</div>
                  </td>
                  <td className="border-b px-3 py-2">{row.totalSections}</td>
                  <td className="border-b px-3 py-2">{row.totalCourses}</td>
                  <td className="border-b px-3 py-2">{row.totalCredits}</td>
                  <td className="border-b px-3 py-2">{row.totalBatchesCovered}</td>
                  <td className="border-b px-3 py-2">{row.totalFacultyAssigned}</td>
                  <td className="border-b px-3 py-2">{row.theorySections}</td>
                  <td className="border-b px-3 py-2">{row.labSections}</td>
                  <td className="border-b px-3 py-2">{row.projectSections}</td>
                </tr>
              ))}

              {programRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No confirmed offering summary found for the selected term.
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
"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type FacultyLoadItem = {
  offeredCourseId: number;
  courseCode: string;
  courseTitle: string;
  section: string;
  programCode: string;
  assignedCredit: number;
  batchCodes: string[];
  linkedSecondaryCourseCodes: string[];
};

type FacultyLoadRow = {
  teacherId: number;
  teacherCode: string;
  teacherName: string;
  designation: string | null;
  totalAssignedCredits: number;
  totalAssignedSections: number;
  loadLevel: string;
  loadMessage: string;
  items: FacultyLoadItem[];
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  termName?: string;
  summary?: {
    totalTeachers: number;
    totalAssignedSections: number;
    totalAssignedCredits: number;
  };
  rows?: FacultyLoadRow[];
};

function badgeClass(level: string) {
  if (level === "OVERLOAD") return "bg-red-100 text-red-700";
  if (level === "WARNING") return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

export default function FacultyLoadPageClient() {
  const { terms, termName, setTermName, loadingTerms, termError } = useAcademicTerms();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<FacultyLoadRow[]>([]);
  const [summary, setSummary] = useState<ApiResponse["summary"] | null>(null);

  async function loadReport() {
    if (!termName) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/reports/faculty-load?termName=${encodeURIComponent(termName)}`,
        {
          cache: "no-store",
        }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load faculty load report.");
      }

      setRows(json.rows || []);
      setSummary(json.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty load report.");
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
    <AdminLayout title="Faculty Load Report">
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
                {loading ? "Loading..." : "Refresh Faculty Load"}
              </button>

              <a
                href={`/api/export/faculty-load?termName=${encodeURIComponent(termName || "")}`}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Download Faculty Load CSV
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
                Total Teachers: {summary.totalTeachers}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                Assigned Sections: {summary.totalAssignedSections}
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                Assigned Credits: {summary.totalAssignedCredits}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {rows.map((row) => (
            <div
              key={row.teacherId}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {row.teacherCode} — {row.teacherName}
                  </h3>
                  <p className="text-sm text-slate-600">{row.designation || "-"}</p>
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                    Sections: {row.totalAssignedSections}
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                    Credits: {row.totalAssignedCredits}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 font-medium ${badgeClass(
                      row.loadLevel
                    )}`}
                    title={row.loadMessage}
                  >
                    {row.loadLevel}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-3 text-left">Course</th>
                      <th className="border-b px-3 py-3 text-left">Section</th>
                      <th className="border-b px-3 py-3 text-left">Program</th>
                      <th className="border-b px-3 py-3 text-left">Assigned Credit</th>
                      <th className="border-b px-3 py-3 text-left">Batches</th>
                      <th className="border-b px-3 py-3 text-left">Linked Secondary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.items.map((item) => (
                      <tr key={item.offeredCourseId}>
                        <td className="border-b px-3 py-2">
                          {item.courseCode} — {item.courseTitle}
                        </td>
                        <td className="border-b px-3 py-2">{item.section}</td>
                        <td className="border-b px-3 py-2">{item.programCode}</td>
                        <td className="border-b px-3 py-2">{item.assignedCredit}</td>
                        <td className="border-b px-3 py-2">
                          {item.batchCodes.join(", ") || "-"}
                        </td>
                        <td className="border-b px-3 py-2">
                          {item.linkedSecondaryCourseCodes.join(", ") || "-"}
                        </td>
                      </tr>
                    ))}

                    {row.items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                          No assigned sections found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {rows.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              No confirmed faculty load data found for the selected term.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
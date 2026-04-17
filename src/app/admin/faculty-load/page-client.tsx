"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramTermSelector from "@/components/program-term-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type FacultyCourseRow = {
  courseCode: string;
  courseTitle: string;
  section: string;
  credit: number;
  courseType: string;
  batches: string[];
};

type FacultyLoadRow = {
  teacherId: number;
  teacherCode: string;
  fullName: string;
  designation: string | null;
  totalCredits: number;
  theoryCredits: number;
  labCredits: number;
  courses: FacultyCourseRow[];
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  rows?: FacultyLoadRow[];
};

export default function FacultyLoadPageClient() {
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<FacultyLoadRow[]>([]);

  async function handleLoad(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setRows([]);

    try {
      const res = await fetch(
        `/api/faculty-load?programCode=${encodeURIComponent(
          programCode
        )}&termName=${encodeURIComponent(termName)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load faculty load.");
      }

      setRows(json.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty load.");
    } finally {
      setLoading(false);
    }
  }

  const combinedError = error || programError || termError;

  return (
    <AdminLayout title="Faculty Load">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Faculty load summary
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Program and term are now selected from dropdowns only.
          </p>
        </div>

        <form onSubmit={handleLoad} className="space-y-4">
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

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || !programCode || !termName}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Faculty Load"}
            </button>

            <a
              href={`/api/export/faculty-load?programCode=${encodeURIComponent(
                programCode
              )}&termName=${encodeURIComponent(termName)}`}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Download Faculty Load Excel
            </a>
          </div>
        </form>

        {combinedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        )}

        <div className="space-y-4">
          {rows.map((row) => (
            <div
              key={row.teacherId}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    {row.teacherCode} — {row.fullName}
                  </h4>
                  <p className="text-sm text-slate-500">
                    {row.designation || "-"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-slate-500">Total</div>
                    <div className="font-semibold text-slate-900">
                      {row.totalCredits}
                    </div>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                    <div className="text-green-700">Theory</div>
                    <div className="font-semibold text-green-900">
                      {row.theoryCredits}
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-amber-700">Lab</div>
                    <div className="font-semibold text-amber-900">
                      {row.labCredits}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-3 text-left">Course Code</th>
                      <th className="border-b px-3 py-3 text-left">Course Title</th>
                      <th className="border-b px-3 py-3 text-left">Section</th>
                      <th className="border-b px-3 py-3 text-left">Credit</th>
                      <th className="border-b px-3 py-3 text-left">Type</th>
                      <th className="border-b px-3 py-3 text-left">Batches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.courses.map((course, index) => (
                      <tr key={`${row.teacherId}-${index}`}>
                        <td className="border-b px-3 py-2">{course.courseCode}</td>
                        <td className="border-b px-3 py-2">{course.courseTitle}</td>
                        <td className="border-b px-3 py-2">{course.section}</td>
                        <td className="border-b px-3 py-2">{course.credit}</td>
                        <td className="border-b px-3 py-2">{course.courseType}</td>
                        <td className="border-b px-3 py-2">
                          {course.batches.join(", ")}
                        </td>
                      </tr>
                    ))}

                    {row.courses.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-6 text-center text-slate-500"
                        >
                          No assigned courses.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              No faculty load loaded yet.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
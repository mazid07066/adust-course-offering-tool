"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramTermSelector from "@/components/program-term-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type ScheduleRow = {
  day: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  startTime: string;
  endTime: string;
  room: string;
  faculty: string;
  slotType: string;
};

type ScheduleResponse = {
  success?: boolean;
  error?: string;
  rows?: ScheduleRow[];
};

export default function SchedulePageClient() {
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
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  async function handleLoad(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setRows([]);

    try {
      const res = await fetch(
        `/api/schedule-report?programCode=${encodeURIComponent(
          programCode
        )}&termName=${encodeURIComponent(termName)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json: ScheduleResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load schedule.");
      }

      setRows(json.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }

  const combinedError = error || programError || termError;

  return (
    <AdminLayout title="Schedule">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Confirmed schedule
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
              {loading ? "Loading..." : "Load Schedule"}
            </button>

            <a
              href={`/api/export/schedule?programCode=${encodeURIComponent(
                programCode
              )}&termName=${encodeURIComponent(termName)}`}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Download Schedule Excel
            </a>
          </div>
        </form>

        {combinedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Day</th>
                <th className="border-b px-3 py-3 text-left">Course Code</th>
                <th className="border-b px-3 py-3 text-left">Course Title</th>
                <th className="border-b px-3 py-3 text-left">Section</th>
                <th className="border-b px-3 py-3 text-left">Start</th>
                <th className="border-b px-3 py-3 text-left">End</th>
                <th className="border-b px-3 py-3 text-left">Room</th>
                <th className="border-b px-3 py-3 text-left">Faculty</th>
                <th className="border-b px-3 py-3 text-left">Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td className="border-b px-3 py-2">{row.day}</td>
                  <td className="border-b px-3 py-2">{row.courseCode}</td>
                  <td className="border-b px-3 py-2">{row.courseTitle}</td>
                  <td className="border-b px-3 py-2">{row.section}</td>
                  <td className="border-b px-3 py-2">{row.startTime}</td>
                  <td className="border-b px-3 py-2">{row.endTime}</td>
                  <td className="border-b px-3 py-2">{row.room}</td>
                  <td className="border-b px-3 py-2">{row.faculty}</td>
                  <td className="border-b px-3 py-2">{row.slotType}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No schedule loaded yet.
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
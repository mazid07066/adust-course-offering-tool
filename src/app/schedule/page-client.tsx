"use client";

import { useEffect, useState } from "react";

type ScheduleRow = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  programCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  facultyText: string;
  batchCodes: string[];
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  terms?: string[];
  filters?: {
    programs: string[];
    batches: string[];
    days: string[];
  };
  rows?: ScheduleRow[];
};

export default function PublicSchedulePageClient() {
  const [terms, setTerms] = useState<string[]>([]);
  const [termName, setTermName] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [filters, setFilters] = useState<{ programs: string[]; batches: string[]; days: string[] }>({
    programs: [],
    batches: [],
    days: [],
  });
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadTerms() {
    const res = await fetch("/api/public/schedule", { cache: "no-store" });
    const json: ApiResponse = await res.json();
    setTerms(json.terms || []);
  }

  async function loadRows(nextTerm?: string) {
    const activeTerm = nextTerm || termName;
    if (!activeTerm) return;

    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams();
      qs.set("termName", activeTerm);
      if (programCode) qs.set("programCode", programCode);
      if (batchCode) qs.set("batchCode", batchCode);
      if (dayOfWeek) qs.set("dayOfWeek", dayOfWeek);

      const res = await fetch(`/api/public/schedule?${qs.toString()}`, { cache: "no-store" });
      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load schedule.");
      }

      setFilters(json.filters || { programs: [], batches: [], days: [] });
      setRows(json.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTerms();
  }, []);

  useEffect(() => {
    if (termName) {
      loadRows();
    }
  }, [termName, programCode, batchCode, dayOfWeek]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">ADUST Public Schedule</h1>
          <p className="mt-2 text-sm text-slate-600">
            Confirmed class and lab schedule for students.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Academic Term</label>
              <select
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">Select Term</option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Program</label>
              <select
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">All Programs</option>
                {filters.programs.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Batch</label>
              <select
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">All Batches</option>
                {filters.batches.map((batch) => (
                  <option key={batch} value={batch}>
                    {batch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">All Days</option>
                {filters.days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
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
                <th className="border-b px-3 py-3 text-left">Batch</th>
                <th className="border-b px-3 py-3 text-left">Teacher</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.programCode}-${row.courseCode}-${row.section}-${row.dayOfWeek}-${row.startTime}-${index}`}
                >
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
                  <td className="border-b px-3 py-2">{row.batchCodes.join(", ")}</td>
                  <td className="border-b px-3 py-2">{row.facultyText}</td>
                </tr>
              ))}

              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No confirmed schedule rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
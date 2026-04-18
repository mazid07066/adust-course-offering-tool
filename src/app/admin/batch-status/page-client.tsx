"use client";

import { useEffect, useState } from "react";

type ProgramOption = {
  id: number;
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: string;
  curriculumVersion: string;
  curriculumKey: string | null;
  studentIdSuffix: string | null;
  displayLabel: string;
  active: boolean;
};

type BatchOption = {
  batchCode: string;
};

type BatchStatusResponse = {
  selectedProgram: {
    programCode: string;
    displayLabel: string;
    curriculumKey: string | null;
  };
  batchCode: string;
  counts: {
    completed: number;
    ongoing: number;
    remaining: number;
    masterCourses: number;
  };
  completedCourses: Array<{
    semester: string;
    code: string;
    title: string;
    credits: number;
    grade: string;
  }>;
  ongoingCourses: Array<{
    semester: string;
    code: string;
    title: string;
    credits: number;
  }>;
  remainingCourses: Array<{
    code: string;
    title: string;
    credits: number;
    type: string;
    group: string | null;
    levelTerm: string | null;
  }>;
  statusRows: Array<{
    code: string;
    title: string;
    credits: number;
    type: string;
    group: string | null;
    levelTerm: string | null;
    status: string;
    color: string;
  }>;
};

export default function BatchStatusPageClient() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [programCode, setProgramCode] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BatchStatusResponse | null>(null);

  useEffect(() => {
    async function loadPrograms() {
      try {
        const res = await fetch("/api/academic-catalog/options", { cache: "no-store" });
        const data = await res.json();
        setPrograms(data.programs || []);
      } catch {
        setPrograms([]);
      }
    }

    loadPrograms();
  }, []);

  useEffect(() => {
    async function loadBatches() {
      if (!programCode) {
        setBatches([]);
        setBatchCode("");
        return;
      }

      try {
        const res = await fetch(
          `/api/program-batches/options?programCode=${encodeURIComponent(programCode)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setBatches((data.batches || []).map((b: string) => ({ batchCode: b })));
        setBatchCode("");
      } catch {
        setBatches([]);
        setBatchCode("");
      }
    }

    loadBatches();
  }, [programCode]);

  async function handleLoad(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `/api/batch-status?programCode=${encodeURIComponent(programCode)}&batchCode=${encodeURIComponent(batchCode)}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load batch status.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch status.");
    } finally {
      setLoading(false);
    }
  }

  function badgeClass(color: string) {
    if (color === "green") return "bg-green-100 text-green-700";
    if (color === "blue") return "bg-blue-100 text-blue-700";
    return "bg-amber-100 text-amber-700";
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Batch Academic Status</h2>
        <p className="mt-2 text-sm text-slate-600">
          Load saved batch-wise completed, ongoing, and remaining course status.
        </p>

        <form onSubmit={handleLoad} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Program / Curriculum</label>
            <select
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2"
              required
            >
              <option value="">Select program</option>
              {programs.map((program) => (
                <option key={program.programCode} value={program.programCode}>
                  {program.displayLabel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Batch</label>
            <select
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2"
              required
            >
              <option value="">Select batch</option>
              {batches.map((batch) => (
                <option key={batch.batchCode} value={batch.batchCode}>
                  {batch.batchCode}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Batch Status"}
            </button>
          </div>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      {result ? (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Completed
              </p>
              <h4 className="mt-2 text-3xl font-bold text-green-700">
                {result.counts.completed}
              </h4>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Ongoing
              </p>
              <h4 className="mt-2 text-3xl font-bold text-blue-700">
                {result.counts.ongoing}
              </h4>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Remaining
              </p>
              <h4 className="mt-2 text-3xl font-bold text-amber-700">
                {result.counts.remaining}
              </h4>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Curriculum Rows
              </p>
              <h4 className="mt-2 text-3xl font-bold text-slate-900">
                {result.counts.masterCourses}
              </h4>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Full Course Status Table</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Credits</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.statusRows.map((row) => (
                    <tr key={row.code} className="border-b">
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.credits}</td>
                      <td className="px-3 py-2">{row.type}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(
                            row.color
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!result.statusRows.length ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={5}>
                        No saved batch status found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Completed Courses</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2">Semester</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Credits</th>
                    <th className="px-3 py-2">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {result.completedCourses.map((row) => (
                    <tr key={`${row.semester}-${row.code}`} className="border-b">
                      <td className="px-3 py-2">{row.semester}</td>
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.credits}</td>
                      <td className="px-3 py-2">{row.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Ongoing Courses</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2">Semester</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ongoingCourses.map((row) => (
                    <tr key={`${row.semester}-${row.code}`} className="border-b">
                      <td className="px-3 py-2">{row.semester}</td>
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
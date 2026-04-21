"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

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
  id: number;
  batchCode: string;
  admissionTerm: string | null;
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

type ProgramBatchesApiResponse = {
  ok?: boolean;
  error?: string;
  batches?: Array<{
    id: number;
    batchCode: string;
    admissionTerm: string | null;
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
        const res = await fetch("/api/academic-catalog/options", {
          cache: "no-store",
        });
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
        const data: ProgramBatchesApiResponse = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load batch options.");
        }

        setBatches(data.batches || []);
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
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout title="Batch Status">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Batch Academic Status
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Review completed, ongoing, remaining, and full curriculum status for a selected batch.
          </p>
        </div>

        <form onSubmit={handleLoad} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Program / Curriculum
            </label>
            <select
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            >
              <option value="">Select Academic Identity</option>
              {programs.map((program) => (
                <option key={program.programCode} value={program.programCode}>
                  {program.displayLabel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Batch
            </label>
            <select
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
              disabled={!programCode}
            >
              <option value="">
                {programCode ? "Select Batch" : "Choose Academic Identity First"}
              </option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.batchCode}>
                  {batch.batchCode}
                  {batch.admissionTerm ? ` | ${batch.admissionTerm}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={!programCode || !batchCode || loading}
              className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Batch Status"}
            </button>
          </div>
        </form>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Completed
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">
                  {result.counts.completed}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ongoing
                </div>
                <div className="mt-2 text-2xl font-bold text-blue-700">
                  {result.counts.ongoing}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Remaining
                </div>
                <div className="mt-2 text-2xl font-bold text-amber-700">
                  {result.counts.remaining}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Master Courses
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {result.counts.masterCourses}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">
                Selected Batch
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {result.selectedProgram.displayLabel} | Batch {result.batchCode}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Curriculum Key: {result.selectedProgram.curriculumKey || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Full Course Status Table
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border-b px-3 py-3 text-left">Code</th>
                      <th className="border-b px-3 py-3 text-left">Title</th>
                      <th className="border-b px-3 py-3 text-left">Credits</th>
                      <th className="border-b px-3 py-3 text-left">Type</th>
                      <th className="border-b px-3 py-3 text-left">Group</th>
                      <th className="border-b px-3 py-3 text-left">Level / Term</th>
                      <th className="border-b px-3 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.statusRows.map((row) => (
                      <tr key={`${row.code}-${row.status}`}>
                        <td className="border-b px-3 py-2">{row.code}</td>
                        <td className="border-b px-3 py-2">{row.title}</td>
                        <td className="border-b px-3 py-2">{row.credits}</td>
                        <td className="border-b px-3 py-2">{row.type}</td>
                        <td className="border-b px-3 py-2">{row.group || "-"}</td>
                        <td className="border-b px-3 py-2">{row.levelTerm || "-"}</td>
                        <td className="border-b px-3 py-2">
                          <span
                            className="rounded-full px-2 py-1 text-xs font-medium"
                            style={{
                              backgroundColor: row.color || "#e5e7eb",
                              color: "#111827",
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {result.statusRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          No status rows found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";

type CatalogProgram = {
  id: number;
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: string;
  curriculumVersion: string;
  studentIdSuffix: string | null;
  displayLabel: string;
  active: boolean;
};

type ImportResult = {
  success?: boolean;
  message?: string;
  error?: string;
  studentId?: string;
  batchCode?: string;
  inferredProgramCode?: string | null;
  inferredSuffix?: string | null;
  transcriptSemester?: string | null;
  registrationSemester?: string | null;
  completedCount?: number;
  ongoingCount?: number;
  remainingCount?: number;
};

export default function ImportsPageClient() {
  const [programs, setPrograms] = useState<CatalogProgram[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);

  const [programCode, setProgramCode] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPrograms() {
      setLoadingPrograms(true);
      setError("");

      try {
        const res = await fetch("/api/academic-catalog/options", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load academic identities.");
        }

        if (!mounted) return;

        const rows: CatalogProgram[] = data.programs || [];
        setPrograms(rows);

        if (rows.length > 0) {
          setProgramCode((prev) => prev || rows[0].programCode);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load academic identities.");
      } finally {
        if (mounted) setLoadingPrograms(false);
      }
    }

    loadPrograms();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedProgram = useMemo(
    () => programs.find((p) => p.programCode === programCode) || null,
    [programs, programCode]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      if (!programCode) {
        throw new Error("Please select an academic identity.");
      }

      if (!transcriptFile && !registrationFile) {
        throw new Error("Please upload at least one PDF file.");
      }

      const formData = new FormData();
      formData.append("programCode", programCode);

      if (transcriptFile) {
        formData.append("transcript", transcriptFile);
      }

      if (registrationFile) {
        formData.append("registration", registrationFile);
      }

      const res = await fetch("/api/student-status-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Student status import failed.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Student status import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Transcript & Registration Import</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Import transcript PDF and registration PDF to derive completed, ongoing, and remaining
          courses batch-wise for the selected academic identity.
        </p>

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-900">Structured import rule</p>
          <p className="mt-2">
            Select the exact academic identity from the dropdown first. Student IDs follow the
            pattern{" "}
            <span className="rounded bg-white px-2 py-1 font-mono">XXX-YYYY-ZZZ</span> where{" "}
            <span className="font-semibold">XXX</span> is the batch code and{" "}
            <span className="font-semibold">ZZZ</span> is the configured program suffix. The
            selected academic identity and the student ID suffix should agree unless the student is
            a migrated case.
          </p>
          <p className="mt-2">
            Transcript PDF provides completed-course history. Courses with grade{" "}
            <span className="rounded bg-white px-2 py-1 font-mono">F</span> are treated as not
            completed. Registration PDF provides the currently ongoing courses for the current
            semester.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800">
              Academic Identity
            </label>
            <select
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              disabled={loadingPrograms || submitting}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
            >
              {programs.map((program) => (
                <option key={program.programCode} value={program.programCode}>
                  {program.displayLabel}
                </option>
              ))}
            </select>
          </div>

          {selectedProgram ? (
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Department
                </p>
                <p className="mt-1 font-medium text-slate-900">{selectedProgram.departmentName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Program Code
                </p>
                <p className="mt-1 font-medium text-slate-900">{selectedProgram.programCode}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shift / Curriculum
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {selectedProgram.studyShift} / {selectedProgram.curriculumVersion}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Student ID Suffix
                </p>
                <p className="mt-1 font-medium text-slate-900">
                  {selectedProgram.studentIdSuffix || "-"}
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Transcript PDF
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)}
                disabled={submitting}
                className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">
                Upload transcript PDF to detect passed and failed course history.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Registration PDF
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setRegistrationFile(e.target.files?.[0] || null)}
                disabled={submitting}
                className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">
                Upload registration PDF to detect currently ongoing courses and current semester.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting || loadingPrograms}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Importing..." : "Import Student Status"}
            </button>
          </div>
        </form>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-6 rounded-3xl border border-green-200 bg-green-50 p-5">
            <h3 className="text-lg font-bold text-slate-900">Import Result</h3>

            {result.message ? (
              <p className="mt-2 text-sm leading-6 text-slate-700">{result.message}</p>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Student ID
                </p>
                <p className="mt-1 font-semibold text-slate-900">{result.studentId || "-"}</p>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Batch Code
                </p>
                <p className="mt-1 font-semibold text-slate-900">{result.batchCode || "-"}</p>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Inferred Program
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {result.inferredProgramCode || "-"}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Inferred Suffix
                </p>
                <p className="mt-1 font-semibold text-slate-900">{result.inferredSuffix || "-"}</p>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Transcript Semester
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {result.transcriptSemester || "-"}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Registration Semester
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {result.registrationSemester || "-"}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Completed Courses
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {result.completedCount ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ongoing Courses
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {result.ongoingCount ?? "-"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Remaining Courses
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {result.remainingCount ?? "-"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
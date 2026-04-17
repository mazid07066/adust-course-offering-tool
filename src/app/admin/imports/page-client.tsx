"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type ProgramOption = {
  id: string;
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: string;
  curriculumVersion: string;
  displayLabel: string;
};

type ImportResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  batchCode?: string;
  detectedStudentId?: string | null;
  registrationSemester?: string | null;
  latestCompletedSemester?: string | null;
  completedImported?: number;
  ongoingImported?: number;
  inferenceWarning?: string | null;
  inferredProgram?: {
    inferredDepartmentCode: string | null;
    inferredProgramCode: string | null;
    inferredVariant: string | null;
    reason: string;
  };
  importTarget?: {
    departmentCode: string | null;
    departmentName: string | null;
    programCode: string;
    programName: string;
    batchId: number;
    batchCode: string;
    alreadyExisted: boolean;
  };
};

export default function ImportsPageClient() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programCode, setProgramCode] = useState("");
  const [transcriptPdf, setTranscriptPdf] = useState<File | null>(null);
  const [registrationPdf, setRegistrationPdf] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);

  useEffect(() => {
    async function loadOptions() {
      setLoadingPrograms(true);
      try {
        const res = await fetch("/api/academic-catalog/options", {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load catalog options.");
        }

        setPrograms(json.programs || []);
        if (json.programs?.length) {
          setProgramCode(json.programs[0].programCode);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load catalog options."
        );
      } finally {
        setLoadingPrograms(false);
      }
    }

    loadOptions();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      if (!programCode) throw new Error("Program is required.");
      if (!registrationPdf) throw new Error("Registration PDF is required.");

      const formData = new FormData();
      formData.append("programCode", programCode);
      formData.append("replaceExisting", String(replaceExisting));
      formData.append("registrationPdf", registrationPdf);

      if (transcriptPdf) {
        formData.append("transcriptPdf", transcriptPdf);
      }

      const res = await fetch("/api/student-status-import", {
        method: "POST",
        body: formData,
      });

      const json: ImportResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Import failed.");
      }

      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProgram =
    programs.find((p) => p.programCode === programCode) || null;

  return (
    <AdminLayout title="Transcript & Registration Import">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Batch-wise student status import
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            All academic identity fields now come from dropdowns only.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Target Program / Curriculum
            </label>
            <select
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              disabled={loadingPrograms}
              className="w-full rounded-xl border px-4 py-3"
            >
              {programs.map((p) => (
                <option key={p.programCode} value={p.programCode}>
                  {p.displayLabel}
                </option>
              ))}
            </select>
          </div>

          {selectedProgram && (
            <div className="grid gap-4 md:grid-cols-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div>
                <span className="font-medium text-slate-700">Department:</span>{" "}
                {selectedProgram.departmentCode}
              </div>
              <div>
                <span className="font-medium text-slate-700">Program:</span>{" "}
                {selectedProgram.programCode}
              </div>
              <div>
                <span className="font-medium text-slate-700">Shift:</span>{" "}
                {selectedProgram.studyShift}
              </div>
              <div>
                <span className="font-medium text-slate-700">Curriculum:</span>{" "}
                {selectedProgram.curriculumVersion}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Transcript PDF
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setTranscriptPdf(e.target.files?.[0] || null)}
                className="block w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Registration PDF
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setRegistrationPdf(e.target.files?.[0] || null)}
                className="block w-full rounded-xl border px-4 py-3"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Replace existing imported status for this batch
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? "Importing..." : "Import Student Status"}
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result?.importTarget && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <h4 className="mb-4 text-base font-semibold text-blue-900">
              Import Storage Target
            </h4>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <span className="font-medium text-blue-900">Department:</span>{" "}
                {result.importTarget.departmentCode} — {result.importTarget.departmentName}
              </div>
              <div>
                <span className="font-medium text-blue-900">Program:</span>{" "}
                {result.importTarget.programCode} — {result.importTarget.programName}
              </div>
              <div>
                <span className="font-medium text-blue-900">Batch Record:</span>{" "}
                ID {result.importTarget.batchId} / Batch {result.importTarget.batchCode}
              </div>
            </div>
          </div>
        )}

        {result?.inferenceWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {result.inferenceWarning}
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="mb-4 text-base font-semibold text-slate-900">
              Import Summary
            </h4>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Detected Student ID</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {result.detectedStudentId || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Detected Batch Code</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {result.batchCode || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Registration Semester</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {result.registrationSemester || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Latest Completed Semester</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {result.latestCompletedSemester || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-700">Completed Imported</p>
                <p className="mt-2 text-xl font-semibold text-green-900">
                  {result.completedImported || 0}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-700">Ongoing Imported</p>
                <p className="mt-2 text-xl font-semibold text-amber-900">
                  {result.ongoingImported || 0}
                </p>
              </div>
            </div>

            {result.inferredProgram && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">
                  Student ID inference
                </p>
                <div className="mt-2 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                  <div>
                    <span className="font-medium">Department:</span>{" "}
                    {result.inferredProgram.inferredDepartmentCode || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Program:</span>{" "}
                    {result.inferredProgram.inferredProgramCode || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Variant:</span>{" "}
                    {result.inferredProgram.inferredVariant || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Reason:</span>{" "}
                    {result.inferredProgram.reason || "-"}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
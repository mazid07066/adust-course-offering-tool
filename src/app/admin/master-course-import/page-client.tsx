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
  insertedCount?: number;
  updatedCount?: number;
  parsedCount?: number;
  deactivatedReferencedCount?: number;
  deletedUnreferencedCount?: number;
  programCode?: string;
  programName?: string;
  departmentCode?: string;
  departmentName?: string;
  routeVersion?: string;
};

export default function MasterCourseImportPageClient() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programCode, setProgramCode] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [file, setFile] = useState<File | null>(null);

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
      if (!file) throw new Error("Please choose a file.");

      const formData = new FormData();
      formData.append("programCode", programCode);
      formData.append("replaceExisting", String(replaceExisting));
      formData.append("file", file);

      const res = await fetch("/api/master-course-import", {
        method: "POST",
        body: formData,
      });

      const json: ImportResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          `${json.error || "Master course import failed."}${json.routeVersion ? ` [${json.routeVersion}]` : ""}`
        );
      }

      setResult(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Master course import failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProgram =
    programs.find((p) => p.programCode === programCode) || null;

  return (
    <AdminLayout title="Master Course Import">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Upload master course list
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Program identity comes only from the backend catalog. No free-text program input is used.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Program / Curriculum
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
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-4">
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

          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Replace existing master courses for this exact program/curriculum
          </label>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.doc,.docx,.docm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full rounded-xl border px-4 py-3"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? "Importing..." : "Import Master Course List"}
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <h4 className="mb-4 text-base font-semibold text-green-900">
              Import Completed
            </h4>

            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div>
                <span className="font-medium text-green-900">Route Version:</span>{" "}
                <span className="text-slate-700">{result.routeVersion || "-"}</span>
              </div>
              <div>
                <span className="font-medium text-green-900">Department:</span>{" "}
                <span className="text-slate-700">
                  {result.departmentCode} — {result.departmentName}
                </span>
              </div>
              <div>
                <span className="font-medium text-green-900">Program:</span>{" "}
                <span className="text-slate-700">
                  {result.programCode} — {result.programName}
                </span>
              </div>
              <div>
                <span className="font-medium text-green-900">Parsed:</span>{" "}
                <span className="text-slate-700">{result.parsedCount || 0}</span>
              </div>
              <div>
                <span className="font-medium text-green-900">Inserted:</span>{" "}
                <span className="text-slate-700">{result.insertedCount || 0}</span>
              </div>
              <div>
                <span className="font-medium text-green-900">Updated:</span>{" "}
                <span className="text-slate-700">{result.updatedCount || 0}</span>
              </div>
              <div>
                <span className="font-medium text-green-900">Deactivated Referenced:</span>{" "}
                <span className="text-slate-700">{result.deactivatedReferencedCount || 0}</span>
              </div>
              <div>
                <span className="font-medium text-green-900">Deleted Unreferenced:</span>{" "}
                <span className="text-slate-700">{result.deletedUnreferencedCount || 0}</span>
              </div>
              <div>
                <span className="font-medium text-green-900">Message:</span>{" "}
                <span className="text-slate-700">{result.message}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
"use client";

import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type ProgramOption = {
  id?: number;
  programCode?: string;
  program_code?: string;
  displayLabel?: string;
  display_label?: string;
};

type TermOption = {
  id?: number;
  name: string;
};

type PreviewRow = {
  status?: string;
  batchCode?: string;
  courseCode?: string;
  courseTitle?: string;
  coofferedCourseCode?: string;
  facultyInitial?: string;
  section?: string;
  credit?: number;
  day?: string;
  time?: string;
  room?: string;
  issues?: string[];
  validationStatus?: string;
  conflictTypes?: string[];
};

type PreviewResponse = {
  error?: string;
  previewRows?: PreviewRow[];
};

type ValidationResponse = {
  error?: string;
  summary?: {
    totalRows: number;
    okRows: number;
    conflictRows: number;
    blockedRows: number;
  };
  rows?: PreviewRow[];
};

function getProgramValue(program: ProgramOption) {
  return program.programCode || program.program_code || "";
}

function getProgramLabel(program: ProgramOption) {
  return program.displayLabel || program.display_label || getProgramValue(program) || "Unnamed Program";
}

export default function OfferingValidationPageClient() {
  const { programs, loadingPrograms, programError } = useAcademicCatalogPrograms();
  const { terms, termName, setTermName, loadingTerms, termError } = useAcademicTerms();

  const [programCode, setProgramCode] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [validatedRows, setValidatedRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<ValidationResponse["summary"] | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [validateLoading, setValidateLoading] = useState(false);

  const canPreview = useMemo(() => {
    return Boolean(programCode && termName && file && !previewLoading);
  }, [programCode, termName, file, previewLoading]);

  async function handlePreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!programCode) {
      setError("Please select a program.");
      setMessage("");
      return;
    }

    if (!termName) {
      setError("Please select an academic term.");
      setMessage("");
      return;
    }

    if (!file) {
      setError("Please attach an Excel file.");
      setMessage("");
      return;
    }

    setPreviewLoading(true);
    setError("");
    setMessage("");
    setPreviewRows([]);
    setValidatedRows([]);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("programCode", programCode);
      formData.append("termName", termName);
      formData.append("file", file);

      const res = await fetch("/api/offering-template-import/preview", {
        method: "POST",
        body: formData,
      });

      const json: PreviewResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to preview template.");
      }

      const rows = json.previewRows || [];
      setPreviewRows(rows);
      setMessage(`Preview loaded successfully. ${rows.length} row(s) found.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview template.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleValidate() {
    if (!termName) {
      setError("Please select an academic term first.");
      setMessage("");
      return;
    }

    if (previewRows.length === 0) {
      setError("Please run Preview first.");
      setMessage("");
      return;
    }

    setValidateLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/offering-template-import/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termName,
          rows: previewRows,
        }),
      });

      const json: ValidationResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to validate template.");
      }

      setValidatedRows(json.rows || []);
      setSummary(json.summary || null);
      setMessage("Validation completed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate template.");
    } finally {
      setValidateLoading(false);
    }
  }

  function rowClass(status?: string) {
    if (status === "OK") return "bg-green-50";
    if (status === "CONFLICT") return "bg-red-50";
    if (status === "BLOCKED") return "bg-amber-50";
    return "";
  }

  const displayRows = validatedRows.length > 0 ? validatedRows : previewRows;

  return (
    <AdminLayout title="Offering Validation">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Offering Validation</h3>
          <p className="mt-1 text-sm text-slate-500">
            Upload a prepared offering Excel, preview it, and validate conflicts before importing.
          </p>
        </div>

        <form
          onSubmit={handlePreview}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Program / Curriculum
              </label>
              <select
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                disabled={loadingPrograms}
              >
                <option value="" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                  {loadingPrograms ? "Loading programs..." : "Select Program / Curriculum"}
                </option>

                {(programs as ProgramOption[]).map((program, index) => (
                  <option
                    key={`${getProgramValue(program)}-${index}`}
                    value={getProgramValue(program)}
                    style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  >
                    {getProgramLabel(program)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Academic Term
              </label>
              <select
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                disabled={loadingTerms}
              >
                <option value="" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                  {loadingTerms ? "Loading terms..." : "Select Academic Term"}
                </option>
                {(terms as TermOption[]).map((term) => (
                  <option
                    key={term.name}
                    value={term.name}
                    style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
                  >
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-w-xl">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Excel Template File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const picked = e.target.files?.[0] || null;
                setFile(picked);
              }}
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
            />
            <div className="mt-2 text-xs text-slate-500">
              Selected file: {file ? file.name : "No file selected"}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!canPreview}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {previewLoading ? "Previewing..." : "Preview"}
            </button>

            <button
              type="button"
              onClick={handleValidate}
              disabled={validateLoading || previewRows.length === 0}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {validateLoading ? "Validating..." : "Validate Conflicts"}
            </button>
          </div>

          {(programError || termError) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {programError || termError}
            </div>
          )}
        </form>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {summary && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                Total: {summary.totalRows}
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                OK: {summary.okRows}
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
                Conflict: {summary.conflictRows}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                Blocked: {summary.blockedRows}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Validation</th>
                <th className="border-b px-3 py-3 text-left">Batch</th>
                <th className="border-b px-3 py-3 text-left">Course</th>
                <th className="border-b px-3 py-3 text-left">Faculty</th>
                <th className="border-b px-3 py-3 text-left">Section</th>
                <th className="border-b px-3 py-3 text-left">Day</th>
                <th className="border-b px-3 py-3 text-left">Time</th>
                <th className="border-b px-3 py-3 text-left">Room</th>
                <th className="border-b px-3 py-3 text-left">Issues</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => (
                <tr
                  key={`${row.courseCode || "ROW"}-${row.section || "SEC"}-${index}`}
                  className={rowClass(row.validationStatus || row.status)}
                >
                  <td className="border-b px-3 py-2 font-medium">
                    {row.validationStatus || row.status || "-"}
                  </td>
                  <td className="border-b px-3 py-2">{row.batchCode || "-"}</td>
                  <td className="border-b px-3 py-2">
                    {row.courseCode || "-"} — {row.courseTitle || "-"}
                  </td>
                  <td className="border-b px-3 py-2">{row.facultyInitial || "-"}</td>
                  <td className="border-b px-3 py-2">{row.section || "-"}</td>
                  <td className="border-b px-3 py-2">{row.day || "-"}</td>
                  <td className="border-b px-3 py-2">{row.time || "-"}</td>
                  <td className="border-b px-3 py-2">{row.room || "-"}</td>
                  <td className="border-b px-3 py-2">
                    {(row.issues || []).join(" | ") || "-"}
                  </td>
                </tr>
              ))}

              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No preview or validation rows yet.
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
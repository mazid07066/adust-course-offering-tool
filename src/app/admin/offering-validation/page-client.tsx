"use client";

import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type ProgramOption = {
  id?: number | string;
  programCode: string;
  displayLabel: string;
};

type PreviewRow = {
  status?: string;
  batchCode?: string;
  courseCode?: string;
  courseTitle?: string;
  facultyInitial?: string;
  section?: string;
  credit?: number;
  day?: string;
  time?: string;
  room?: string;
  issues?: string[];
  validationStatus?: string;
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

export default function OfferingValidationPageClient() {
  const { programs, loadingPrograms } = useAcademicCatalogPrograms();
  const { terms, termName, setTermName, loadingTerms } = useAcademicTerms();

  const [programCode, setProgramCode] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [validatedRows, setValidatedRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<ValidationResponse["summary"] | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [validateLoading, setValidateLoading] = useState(false);

  const programOptions: ProgramOption[] = useMemo(() => {
    return programs.map((program) => ({
      id: program.id,
      programCode: program.programCode,
      displayLabel: program.displayLabel,
    }));
  }, [programs]);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();

    if (!programCode || !termName || !file) {
      setError("Program, term and file are required.");
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
        throw new Error(json.error || "Preview failed");
      }

      setPreviewRows(json.previewRows || []);
      setMessage("Preview successful");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleValidate() {
    if (!termName || previewRows.length === 0) {
      setError("Run preview first.");
      return;
    }

    setValidateLoading(true);
    setError("");

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
        throw new Error(json.error || "Validation failed");
      }

      setValidatedRows(json.rows || []);
      setSummary(json.summary || null);
      setMessage("Validation completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setValidateLoading(false);
    }
  }

  const displayRows = validatedRows.length > 0 ? validatedRows : previewRows;

  return (
    <AdminLayout title="Offering Validation">
      <div className="space-y-6">

        <form onSubmit={handlePreview} className="space-y-4 bg-white p-5 rounded-xl border">

          <select
            value={programCode}
            onChange={(e) => setProgramCode(e.target.value)}
            className="w-full border p-3 rounded"
          >
            <option value="">Select Program</option>
            {programOptions.map((p) => (
              <option key={p.programCode} value={p.programCode}>
                {p.displayLabel}
              </option>
            ))}
          </select>

          <select
            value={termName}
            onChange={(e) => setTermName(e.target.value)}
            className="w-full border p-3 rounded"
          >
            <option value="">Select Term</option>
            {terms.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>

          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <button type="submit" className="bg-black text-white px-4 py-2 rounded">
            {previewLoading ? "Previewing..." : "Preview"}
          </button>

          <button
            type="button"
            onClick={handleValidate}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {validateLoading ? "Validating..." : "Validate"}
          </button>
        </form>

        {error && <div className="text-red-600">{error}</div>}
        {message && <div className="text-green-600">{message}</div>}

        {summary && (
          <div className="bg-white p-4 border rounded">
            Total: {summary.totalRows} | OK: {summary.okRows} | Conflict: {summary.conflictRows}
          </div>
        )}

        <table className="w-full border bg-white">
          <thead>
            <tr>
              <th>Status</th>
              <th>Course</th>
              <th>Faculty</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                <td>{row.validationStatus || row.status}</td>
                <td>{row.courseCode}</td>
                <td>{row.facultyInitial}</td>
                <td>{row.day} {row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </AdminLayout>
  );
}
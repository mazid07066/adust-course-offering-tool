"use client";

import { useEffect, useMemo, useState } from "react";

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

type PreviewResponse = {
  success: boolean;
  selectedProgram: {
    programCode: string;
    displayLabel: string;
    curriculumKey?: string | null;
  };
  inferredProgram: {
    programCode: string;
    displayLabel: string;
    curriculumKey?: string | null;
  } | null;
  studentIdentity: {
    studentId: string | null;
    batchCode: string | null;
    suffix: string | null;
  };
  warningMessages: string[];
  transcriptSummary: {
    parsedCount: number;
    latestCompletedTerm: string | null;
    failedOnlyCodes: string[];
    transcriptEarnedCredits: number | null;
    parsedCompletedCredits: number | null;
    completedCreditMismatch: boolean;
  };
  registrationSummary: {
    parsedCount: number;
    currentRegistrationTerm: string | null;
    parsedOngoingCredits: number;
  };
  offeringContext: {
    suggestedNextOfferingTerm: string | null;
  };
  counts: {
    completed: number;
    ongoing: number;
    remaining: number;
    masterCourses: number;
  };
  creditSummary: {
    transcriptEarnedCredits: number | null;
    parsedCompletedCredits: number | null;
    parsedOngoingCredits: number;
    combinedAcademicLoad: number;
    completedCreditMismatch: boolean;
  };
  completedCourses: Array<{
    code: string;
    title: string;
    semester: string;
    credits: number;
    grade: string;
  }>;
  ongoingCourses: Array<{
    code: string;
    title: string;
    credits: number;
    section: string | null;
  }>;
  remainingCourses: Array<{
    code: string;
    title: string;
    credits: number;
    type: string;
    group: string | null;
    levelTerm: string | null;
    curriculumKey?: string | null;
  }>;
  debug?: {
    transcriptTextSample: string;
    registrationTextSample: string;
  };
};

export default function ImportsPageClient() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programCode, setProgramCode] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [result, setResult] = useState<PreviewResponse | null>(null);

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

  const saveBlocked = useMemo(() => {
    return Boolean(result?.creditSummary.completedCreditMismatch);
  }, [result]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaveMessage("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("programCode", programCode);

      if (transcriptFile) {
        formData.append("transcriptFile", transcriptFile);
      }

      if (registrationFile) {
        formData.append("registrationFile", registrationFile);
      }

      const res = await fetch("/api/student-status-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Parsing failed.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parsing failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBatchStatus() {
    if (!result) return;

    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      const res = await fetch("/api/student-status-save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programCode,
          batchCode: result.studentIdentity.batchCode,
          studentId: result.studentIdentity.studentId,
          latestCompletedTerm: result.transcriptSummary.latestCompletedTerm,
          currentRegistrationTerm: result.registrationSummary.currentRegistrationTerm,
          transcriptEarnedCredits: result.creditSummary.transcriptEarnedCredits,
          parsedCompletedCredits: result.creditSummary.parsedCompletedCredits,
          completedCourses: result.completedCourses,
          ongoingCourses: result.ongoingCourses,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save batch status.");
      }

      setSaveMessage(data.message || "Batch status saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save batch status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Transcript and Registration Parsing Preview
        </h2>

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-slate-700">
          <p className="font-semibold text-slate-900">Structured import rule</p>
          <p className="mt-2">
            Select the exact academic identity first. Student IDs follow the pattern{" "}
            <span className="rounded bg-white px-2 py-1 font-semibold">
              XXX-YYYY-ZZZ
            </span>{" "}
            where <span className="font-semibold">XXX</span> is the batch code and{" "}
            <span className="font-semibold">ZZZ</span> is the configured academic suffix.
          </p>
          <p className="mt-2">
            Transcript logic: passed courses with positive earned credit are treated
            as completed. Failed or zero-credit attempts are not completed.
            Registration courses are treated as ongoing.
          </p>
          <p className="mt-2">
            Save is now protected by transcript earned-credit validation. If parsed
            completed credits do not match the transcript earned-credit total, saving
            will be blocked.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Program / Curriculum
            </label>
            <select
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2"
              required
            >
              <option value="">Select exact academic identity</option>
              {programs.map((program) => (
                <option key={program.programCode} value={program.programCode}>
                  {program.displayLabel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Transcript PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)}
              className="w-full rounded-2xl border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Registration PDF
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setRegistrationFile(e.target.files?.[0] || null)}
              className="w-full rounded-2xl border px-3 py-2"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Parsing..." : "Parse and Preview Status"}
            </button>

            {result ? (
              <button
                type="button"
                onClick={handleSaveBatchStatus}
                disabled={saving || saveBlocked}
                className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : saveBlocked ? "Save Blocked" : "Save Batch Status"}
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {saveMessage ? (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            {saveMessage}
          </p>
        ) : null}
      </div>

      {result ? (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Identity and Offering Context
            </h3>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Student ID
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {result.studentIdentity.studentId || "-"}
                </p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Batch Code
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {result.studentIdentity.batchCode || "-"}
                </p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Suffix
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {result.studentIdentity.suffix || "-"}
                </p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Suggested Next Term
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {result.offeringContext.suggestedNextOfferingTerm || "-"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Selected Academic Identity
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {result.selectedProgram.displayLabel}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Inferred From Student ID Suffix
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {result.inferredProgram?.displayLabel || "No inferred match found"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Transcript Parsed Rows
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {result.transcriptSummary.parsedCount}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Registration Parsed Rows
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {result.registrationSummary.parsedCount}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Latest Completed Term
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {result.transcriptSummary.latestCompletedTerm || "-"}
                </p>
              </div>
            </div>

            {result.warningMessages.length ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">Warnings</p>
                <ul className="mt-2 space-y-2 text-sm text-amber-900">
                  {result.warningMessages.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.creditSummary.completedCreditMismatch ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  Save blocked due to transcript mismatch
                </p>
                <p className="mt-2 text-sm text-red-700">
                  Transcript earned credits are{" "}
                  <span className="font-semibold">
                    {result.creditSummary.transcriptEarnedCredits ?? "-"}
                  </span>
                  , but parsed completed credits are{" "}
                  <span className="font-semibold">
                    {result.creditSummary.parsedCompletedCredits ?? "-"}
                  </span>
                  .
                </p>
              </div>
            ) : null}
          </div>

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

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Transcript Earned Credits
              </p>
              <h4 className="mt-2 text-3xl font-bold text-slate-900">
                {result.creditSummary.transcriptEarnedCredits ?? "-"}
              </h4>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Parsed Completed Credits
              </p>
              <h4 className="mt-2 text-3xl font-bold text-green-700">
                {result.creditSummary.parsedCompletedCredits ?? "-"}
              </h4>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Parsed Ongoing Credits
              </p>
              <h4 className="mt-2 text-3xl font-bold text-blue-700">
                {result.creditSummary.parsedOngoingCredits}
              </h4>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Combined Academic Load
              </p>
              <h4 className="mt-2 text-3xl font-bold text-indigo-700">
                {result.creditSummary.combinedAcademicLoad}
              </h4>
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
                  {!result.completedCourses.length ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={5}>
                        No completed courses parsed.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Ongoing Courses From Registration
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Credits</th>
                    <th className="px-3 py-2">Section</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ongoingCourses.map((row) => (
                    <tr key={`${row.code}-${row.section || ""}`} className="border-b">
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.credits}</td>
                      <td className="px-3 py-2">{row.section || "-"}</td>
                    </tr>
                  ))}
                  {!result.ongoingCourses.length ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={4}>
                        No ongoing courses parsed.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Remaining Courses From Imported Curriculum
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Credits</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Group</th>
                    <th className="px-3 py-2">Level / Term</th>
                  </tr>
                </thead>
                <tbody>
                  {result.remainingCourses.map((row) => (
                    <tr key={row.code} className="border-b">
                      <td className="px-3 py-2">{row.code}</td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.credits}</td>
                      <td className="px-3 py-2">{row.type}</td>
                      <td className="px-3 py-2">{row.group || "-"}</td>
                      <td className="px-3 py-2">{row.levelTerm || "-"}</td>
                    </tr>
                  ))}
                  {!result.remainingCourses.length ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={6}>
                        No remaining courses available yet. Import curriculum first, or check selected identity.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {result.debug ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900">Debug Text Samples</h3>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Transcript Extract Sample
                  </p>
                  <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
                    {result.debug.transcriptTextSample || "-"}
                  </pre>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Registration Extract Sample
                  </p>
                  <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
                    {result.debug.registrationTextSample || "-"}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
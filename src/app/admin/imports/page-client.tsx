"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type RefreshMode =
  | "EXISTING_BATCH"
  | "REGISTRATION_ONLY"
  | "NEW_INTAKE";

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

  refreshContext: {
    refreshMode: RefreshMode;
    currentAcademicTerm: string;
    generatedBatchCode: string;
    studentIdPattern: string | null;
    rolloverReady: boolean;
    existingBatchId: number | null;
    existingBatchFound: boolean;
  };

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
    parserSource?: string;
  };

  registrationSummary: {
    parsedCount: number;
    currentRegistrationTerm: string | null;
    parsedOngoingCredits: number;
  };

  offeringContext: {
    suggestedNextOfferingTerm: string | null;
    offeringCandidateCount: number;
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

  offeringCandidateCourses: Array<{
    code: string;
    title: string;
    credits: number;
    section: string | null;
    source: string;
  }>;

  debug?: {
    transcriptTextSample: string;
    registrationTextSample: string;
  };
};

type SaveResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  refreshMode?: RefreshMode;
  currentAcademicTerm?: string;
  batchId?: number;
  batchCode?: string;
  programId?: number;
  admissionTerm?: string | null;
  savedCompleted?: number;
  savedOngoing?: number;
  offeringCandidateSource?: string;
  curriculumCourseCount?: number;
};

export default function ImportsPageClient() {
  const [
    programs,
    setPrograms,
  ] =
    useState<
      ProgramOption[]
    >([]);

  const [
    refreshMode,
    setRefreshMode,
  ] =
    useState<RefreshMode>(
      "EXISTING_BATCH"
    );

  const [
    programCode,
    setProgramCode,
  ] =
    useState("");

  const [
    transcriptFile,
    setTranscriptFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    registrationFile,
    setRegistrationFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    fileInputVersion,
    setFileInputVersion,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    saveMessage,
    setSaveMessage,
  ] =
    useState("");

  const [
    result,
    setResult,
  ] =
    useState<
      PreviewResponse | null
    >(null);

  useEffect(() => {
    async function loadPrograms() {
      try {
        const res =
          await fetch(
            "/api/academic-catalog/options",
            {
              cache:
                "no-store",
            }
          );

        const data =
          await res.json();

        setPrograms(
          data.programs ||
            []
        );
      } catch {
        setPrograms([]);
      }
    }

    loadPrograms();
  }, []);

  const isFullExistingBatch =
    refreshMode ===
    "EXISTING_BATCH";

  const isRegistrationOnly =
    refreshMode ===
    "REGISTRATION_ONLY";

  const isExistingMode =
    isFullExistingBatch ||
    isRegistrationOnly;

  const isNewIntake =
    refreshMode ===
    "NEW_INTAKE";

  const saveBlocked =
    useMemo(() => {
      if (!result) {
        return true;
      }

      if (
        result
          .creditSummary
          .completedCreditMismatch
      ) {
        return true;
      }

      if (
        !result
          .refreshContext
          .rolloverReady
      ) {
        return true;
      }

      if (
        !result
          .studentIdentity
          .batchCode
      ) {
        return true;
      }

      return false;
    }, [result]);

  function clearPreview() {
    setResult(null);
    setError("");
    setSaveMessage("");
  }

  function clearFiles() {
    setTranscriptFile(
      null
    );

    setRegistrationFile(
      null
    );

    setFileInputVersion(
      (value) =>
        value + 1
    );
  }

  function changeRefreshMode(
    mode: RefreshMode
  ) {
    setRefreshMode(mode);
    clearPreview();
    clearFiles();
  }

  function changeProgram(
    value: string
  ) {
    setProgramCode(value);
    clearPreview();
    clearFiles();
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setSaveMessage("");
    setResult(null);

    try {
      if (!programCode) {
        throw new Error(
          "Select a Program / Curriculum first."
        );
      }

      if (
        isFullExistingBatch &&
        !transcriptFile
      ) {
        throw new Error(
          "Existing Batch Refresh requires the latest transcript PDF."
        );
      }

      if (
        isExistingMode &&
        !registrationFile
      ) {
        throw new Error(
          isRegistrationOnly
            ? "Registration-Only Refresh requires the registration PDF."
            : "Existing Batch Refresh requires the latest registration PDF."
        );
      }

      if (
        isRegistrationOnly &&
        transcriptFile
      ) {
        throw new Error(
          "Registration-Only Refresh must not use a transcript PDF."
        );
      }

      const formData =
        new FormData();

      formData.append(
        "refreshMode",
        refreshMode
      );

      formData.append(
        "programCode",
        programCode
      );

      if (
        isFullExistingBatch &&
        transcriptFile
      ) {
        formData.append(
          "transcriptFile",
          transcriptFile
        );
      }

      if (
        isExistingMode &&
        registrationFile
      ) {
        formData.append(
          "registrationFile",
          registrationFile
        );
      }

      const res =
        await fetch(
          "/api/student-status-import",
          {
            method:
              "POST",

            body:
              formData,
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Preview failed."
        );
      }

      setResult(
        data as
          PreviewResponse
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Preview failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBatchStatus() {
    if (!result) {
      return;
    }

    if (saveBlocked) {
      setError(
        "Save is blocked until preview validation is ready."
      );

      return;
    }

    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      const res =
        await fetch(
          "/api/student-status-save",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                refreshMode,

                programCode,

                batchCode:
                  result
                    .studentIdentity
                    .batchCode,

                studentId:
                  isNewIntake
                    ? null
                    : result
                        .studentIdentity
                        .studentId,

                latestCompletedTerm:
                  isNewIntake
                    ? null
                    : result
                        .transcriptSummary
                        .latestCompletedTerm,

                currentRegistrationTerm:
                  isNewIntake
                    ? null
                    : result
                        .registrationSummary
                        .currentRegistrationTerm,

                transcriptEarnedCredits:
                  isNewIntake
                    ? null
                    : result
                        .creditSummary
                        .transcriptEarnedCredits,

                parsedCompletedCredits:
                  isNewIntake
                    ? 0
                    : result
                        .creditSummary
                        .parsedCompletedCredits,

                completedCourses:
                  isNewIntake
                    ? []
                    : result
                        .completedCourses,

                ongoingCourses:
                  isNewIntake
                    ? []
                    : result
                        .ongoingCourses,
              }),
          }
        );

      const data =
        (await res.json()) as
          SaveResponse;

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Save failed."
        );
      }

      const parts = [
        data.message ||
          "Saved successfully.",
      ];

      if (
        data.batchId
      ) {
        parts.push(
          `Batch ID: ${data.batchId}`
        );
      }

      if (
        data.batchCode
      ) {
        parts.push(
          `Batch: ${data.batchCode}`
        );
      }

      if (
        data
          .currentAcademicTerm
      ) {
        parts.push(
          `Term: ${data.currentAcademicTerm}`
        );
      }

      if (
        data
          .curriculumCourseCount !==
        undefined
      ) {
        parts.push(
          `Curriculum courses: ${data.curriculumCourseCount}`
        );
      }

      if (
        !isNewIntake
      ) {
        parts.push(
          `Completed rows: ${data.savedCompleted ?? 0}`
        );

        parts.push(
          `Registration rows: ${data.savedOngoing ?? 0}`
        );
      }

      setSaveMessage(
        parts.join(" | ")
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Save failed."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Semester Batch Preparation
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Refresh historical
          batches, process a newly
          admitted batch that has
          registration only, or
          prepare the current
          incoming batch.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              changeRefreshMode(
                "EXISTING_BATCH"
              )
            }
            className={`rounded-2xl border p-5 text-left ${
              isFullExistingBatch
                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="font-bold text-slate-900">
              Existing Batch Refresh
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              For established batches
              that have both a latest
              transcript and previous
              semester registration.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              changeRefreshMode(
                "REGISTRATION_ONLY"
              )
            }
            className={`rounded-2xl border p-5 text-left ${
              isRegistrationOnly
                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="font-bold text-slate-900">
              Registration-Only Refresh
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              For the immediate
              previous intake that has
              first-semester
              registration but no
              transcript yet.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              changeRefreshMode(
                "NEW_INTAKE"
              )
            }
            className={`rounded-2xl border p-5 text-left ${
              isNewIntake
                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="font-bold text-slate-900">
              New Incoming Batch
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              No transcript and no
              registration PDF. Batch
              code comes from the
              current semester.
            </p>
          </button>
        </div>

        {isNewIntake ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900">
            <p className="font-semibold">
              Automatic batch rule
            </p>

            <p className="mt-2">
              SPRING = year + 1,
              SUMMER = year + 2,
              FALL = year + 3.
            </p>

            <p className="mt-2">
              Examples: FALL 2026 =
              263; SPRING 2027 = 271;
              SUMMER 2027 = 272;
              FALL 2027 = 273.
            </p>

            <p className="mt-2">
              Every active course in
              the selected curriculum
              becomes visible as the
              initial offering pool.
            </p>
          </div>
        ) : isRegistrationOnly ? (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-blue-900">
            <p className="font-semibold">
              First-registration rule
            </p>

            <p className="mt-2">
              Use this only when the
              batch has no transcript
              yet. The registration
              semester must match the
              batch admission term.
            </p>

            <p className="mt-2">
              The following semester
              must also be the current
              UniFlow academic term.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm leading-7 text-slate-700">
            Previous-semester state
            must already be preserved
            in a finalized rollover
            archive before replacing
            live batch status.
          </div>
        )}

        <form
          onSubmit={
            handleSubmit
          }
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Program /
              Curriculum
            </label>

            <select
              value={
                programCode
              }
              onChange={(e) =>
                changeProgram(
                  e.target.value
                )
              }
              className="w-full rounded-2xl border px-3 py-3"
              required
            >
              <option value="">
                Select exact
                academic identity
              </option>

              {programs.map(
                (program) => (
                  <option
                    key={
                      program.programCode
                    }
                    value={
                      program.programCode
                    }
                  >
                    {
                      program.displayLabel
                    }
                  </option>
                )
              )}
            </select>
          </div>

          {isFullExistingBatch ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Latest Transcript
                  PDF
                </label>

                <input
                  key={`transcript-${fileInputVersion}`}
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) =>
                    setTranscriptFile(
                      e.target.files?.[0] ||
                        null
                    )
                  }
                  className="w-full rounded-2xl border px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Previous Semester
                  Registration PDF
                </label>

                <input
                  key={`registration-${fileInputVersion}`}
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) =>
                    setRegistrationFile(
                      e.target.files?.[0] ||
                        null
                    )
                  }
                  className="w-full rounded-2xl border px-3 py-3"
                />
              </div>
            </>
          ) : isRegistrationOnly ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
                <strong>
                  Transcript
                </strong>
                <div className="mt-1">
                  Not required for
                  first-registration
                  refresh.
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  First Semester
                  Registration PDF
                </label>

                <input
                  key={`registration-${fileInputVersion}`}
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) =>
                    setRegistrationFile(
                      e.target.files?.[0] ||
                        null
                    )
                  }
                  className="w-full rounded-2xl border px-3 py-3"
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              No source files required.
              Select a curriculum and
              preview the incoming
              batch.
            </div>
          )}

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={
                loading ||
                !programCode
              }
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading
                ? "Preparing..."
                : isNewIntake
                  ? "Preview New Intake"
                  : isRegistrationOnly
                    ? "Parse Registration and Preview"
                    : "Parse and Preview Status"}
            </button>

            {result ? (
              <button
                type="button"
                onClick={
                  handleSaveBatchStatus
                }
                disabled={
                  saving ||
                  saveBlocked
                }
                className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : saveBlocked
                    ? "Save Blocked"
                    : isNewIntake
                      ? `Create Batch ${result.refreshContext.generatedBatchCode}`
                      : isRegistrationOnly
                        ? "Save Registration-Only Status"
                        : "Save Refreshed Batch Status"}
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {saveMessage ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {saveMessage}
          </div>
        ) : null}
      </div>

      {result ? (
        <>
          <div
            className={`rounded-3xl border p-6 ${
              result
                .refreshContext
                .rolloverReady
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">
                  Semester Preparation
                </h3>

                <p className="mt-2 text-sm">
                  Mode:{" "}
                  <strong>
                    {result
                      .refreshContext
                      .refreshMode ===
                    "REGISTRATION_ONLY"
                      ? "REGISTRATION ONLY"
                      : result
                          .refreshContext
                          .refreshMode}
                  </strong>
                </p>

                <p className="mt-1 text-sm">
                  Current term:{" "}
                  <strong>
                    {
                      result
                        .refreshContext
                        .currentAcademicTerm
                    }
                  </strong>
                </p>

                <p className="mt-1 text-sm">
                  Batch:{" "}
                  <strong>
                    {
                      result
                        .studentIdentity
                        .batchCode
                    }
                  </strong>
                </p>

                <p className="mt-1 text-sm">
                  Resolved batch ID:{" "}
                  <strong>
                    {result
                      .refreshContext
                      .existingBatchId ??
                      "-"}
                  </strong>
                </p>

                {result
                  .refreshContext
                  .studentIdPattern ? (
                  <p className="mt-1 text-sm">
                    Student ID pattern:{" "}
                    <strong className="font-mono">
                      {
                        result
                          .refreshContext
                          .studentIdPattern
                      }
                    </strong>
                  </p>
                ) : null}
              </div>

              <div className="font-bold">
                {result
                  .refreshContext
                  .rolloverReady
                  ? "READY"
                  : "BLOCKED"}
              </div>
            </div>

            {result.warningMessages
              .length ? (
              <ul className="mt-4 space-y-1 text-sm text-amber-800">
                {result.warningMessages.map(
                  (
                    warning,
                    index
                  ) => (
                    <li key={index}>
                      • {warning}
                    </li>
                  )
                )}
              </ul>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5">
              <div className="text-xs uppercase text-slate-500">
                Completed
              </div>

              <div className="mt-2 text-2xl font-bold">
                {
                  result.counts
                    .completed
                }
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5">
              <div className="text-xs uppercase text-slate-500">
                Current
              </div>

              <div className="mt-2 text-2xl font-bold">
                {
                  result.counts
                    .ongoing
                }
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5">
              <div className="text-xs uppercase text-slate-500">
                Available
              </div>

              <div className="mt-2 text-2xl font-bold">
                {
                  result.counts
                    .remaining
                }
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5">
              <div className="text-xs uppercase text-slate-500">
                Curriculum
              </div>

              <div className="mt-2 text-2xl font-bold">
                {
                  result.counts
                    .masterCourses
                }
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h3 className="text-xl font-bold">
              Parsed Semester Context
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border p-4">
                <div className="text-xs uppercase text-slate-500">
                  Latest Completed
                </div>

                <div className="mt-2 font-semibold">
                  {result
                    .transcriptSummary
                    .latestCompletedTerm ||
                    "None"}
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-xs uppercase text-slate-500">
                  Registration
                </div>

                <div className="mt-2 font-semibold">
                  {result
                    .registrationSummary
                    .currentRegistrationTerm ||
                    "Unknown"}
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-xs uppercase text-slate-500">
                  Suggested Next
                </div>

                <div className="mt-2 font-semibold">
                  {result
                    .offeringContext
                    .suggestedNextOfferingTerm ||
                    "Unknown"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6">
            <h3 className="text-xl font-bold">
              {
                result
                  .refreshContext
                  .currentAcademicTerm
              } Offering Pool
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              {isNewIntake
                ? "All active curriculum courses are visible for the incoming batch."
                : isRegistrationOnly
                  ? "The first-semester registered courses are excluded. Remaining curriculum courses become the current offering candidate pool."
                  : "Remaining curriculum courses are shown after completed and current courses are excluded."}
            </p>

            <div className="mt-4 overflow-x-auto rounded-2xl bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-3">
                      Code
                    </th>

                    <th className="px-3 py-3">
                      Title
                    </th>

                    <th className="px-3 py-3">
                      Credits
                    </th>

                    <th className="px-3 py-3">
                      Level / Term
                    </th>

                    <th className="px-3 py-3">
                      Source
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {result
                    .offeringCandidateCourses
                    .map(
                      (row) => {
                        const curriculumRow =
                          result
                            .remainingCourses
                            .find(
                              (course) =>
                                course.code ===
                                row.code
                            );

                        return (
                          <tr
                            key={`${row.code}-${row.source}`}
                            className="border-b"
                          >
                            <td className="px-3 py-2">
                              {
                                row.code
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                row.title
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                row.credits
                              }
                            </td>

                            <td className="px-3 py-2">
                              {curriculumRow
                                ?.levelTerm ||
                                "-"}
                            </td>

                            <td className="px-3 py-2">
                              {
                                row.source
                              }
                            </td>
                          </tr>
                        );
                      }
                    )}
                </tbody>
              </table>
            </div>
          </div>

          {isExistingMode ? (
            <>
              {!isRegistrationOnly ? (
                <div className="rounded-3xl border bg-white p-6">
                  <h3 className="text-xl font-bold">
                    Completed Courses
                  </h3>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-3 py-2">
                            Semester
                          </th>

                          <th className="px-3 py-2">
                            Code
                          </th>

                          <th className="px-3 py-2">
                            Title
                          </th>

                          <th className="px-3 py-2">
                            Credits
                          </th>

                          <th className="px-3 py-2">
                            Grade
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.completedCourses.map(
                          (row) => (
                            <tr
                              key={`${row.semester}-${row.code}`}
                              className="border-b"
                            >
                              <td className="px-3 py-2">
                                {
                                  row.semester
                                }
                              </td>

                              <td className="px-3 py-2">
                                {
                                  row.code
                                }
                              </td>

                              <td className="px-3 py-2">
                                {
                                  row.title
                                }
                              </td>

                              <td className="px-3 py-2">
                                {
                                  row.credits
                                }
                              </td>

                              <td className="px-3 py-2">
                                {
                                  row.grade
                                }
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
                  <h3 className="text-xl font-bold">
                    Completed Courses
                  </h3>

                  <p className="mt-2 text-sm text-blue-900">
                    No transcript exists
                    yet for this
                    immediate-previous
                    intake. Completed
                    history remains empty.
                  </p>
                </div>
              )}

              <div className="rounded-3xl border bg-white p-6">
                <h3 className="text-xl font-bold">
                  {isRegistrationOnly
                    ? "First Semester Registration"
                    : "Previous Semester Registration"}
                </h3>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-3 py-2">
                          Code
                        </th>

                        <th className="px-3 py-2">
                          Title
                        </th>

                        <th className="px-3 py-2">
                          Credits
                        </th>

                        <th className="px-3 py-2">
                          Section
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.ongoingCourses.map(
                        (row) => (
                          <tr
                            key={`${row.code}-${row.section || ""}`}
                            className="border-b"
                          >
                            <td className="px-3 py-2">
                              {
                                row.code
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                row.title
                              }
                            </td>

                            <td className="px-3 py-2">
                              {
                                row.credits
                              }
                            </td>

                            <td className="px-3 py-2">
                              {row.section ||
                                "-"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
"use client";

import {
  useEffect,
  useState,
} from "react";

import AdminLayout from "@/components/admin-layout";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type ViewMode =
  | "DRAFT"
  | "FINAL"
  | "ALL";

type RoutineRow = {
  offeredCourseId: number;
  offeringId: number;
  offeringStatus: string;

  batchCode: string;
  batchCodes: string[];

  programCode: string;
  programLabel: string;

  courseCode: string;
  courseTitle: string;

  section: string;

  facultyText: string;

  dayOfWeek: string;
  startTime: string;
  endTime: string;

  roomCode: string;

  role:
    | "PRIMARY"
    | "SECONDARY";

  primaryReference: string;

  scheduleKind:
    | "ALL"
    | "CLASS"
    | "LAB"
    | "PROJECT";
};

type ApiResponse = {
  success?: boolean;

  error?: string;

  viewMode?: ViewMode;

  statuses?: string[];

  batchOptions?: string[];

  programOptions?: Array<{
    value: string;
    label: string;
  }>;

  programOfferingSummary?: Array<{
    programCode: string;
    programLabel: string;

    totalCourses: number;
    totalCredits: number;

    theoryCourses: number;
    theoryCredits: number;

    labCourses: number;
    labCredits: number;

    projectCourses: number;
    projectCredits: number;

    primaryCourses: number;
    secondaryCourses: number;
  }>;
  summary?: {
    totalRows: number;
    totalBatches: number;
    totalPrograms: number;
    draftRows: number;
    finalRows: number;
    coOfferingRows: number;
  };

  rows?: RoutineRow[];
};

function statusLabel(
  status: string
) {
  switch (status) {
    case "DRAFT":
      return "Draft";

    case "BUFFER_READY":
      return "Ready for Faculty Choice";

    case "FACULTY_CHOICE_BUFFER":
      return "Faculty Choice Open";

    case "FACULTY_CHOICE_FINALIZED":
      return "Faculty Choice Finalized";

    case "CONFIRMED":
      return "Confirmed";

    default:
      return status;
  }
}

function statusClass(
  status: string
) {
  switch (status) {
    case "DRAFT":
      return "bg-amber-100 text-amber-800";

    case "BUFFER_READY":
      return "bg-blue-100 text-blue-800";

    case "FACULTY_CHOICE_BUFFER":
      return "bg-violet-100 text-violet-800";

    case "FACULTY_CHOICE_FINALIZED":
      return "bg-indigo-100 text-indigo-800";

    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-800";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function BatchRoutinePageClient() {
  const {
    terms,
    termName,
    setTermName,
    loadingTerms,
    termError,
  } = useAcademicTerms();

  const [
    viewMode,
    setViewMode,
  ] =
    useState<ViewMode>(
      "DRAFT"
    );

  const [
    batchCode,
    setBatchCode,
  ] =
    useState("");

  const [
    programCode,
    setProgramCode,
  ] =
    useState("");

  const [
    scheduleKind,
    setScheduleKind,
  ] =
    useState("ALL");

  const [
    batchOptions,
    setBatchOptions,
  ] =
    useState<string[]>([]);

  const [
    programOptions,
    setProgramOptions,
  ] =
    useState<
      Array<{
        value: string;
        label: string;
      }>
    >([]);

  const [
    rows,
    setRows,
  ] =
    useState<RoutineRow[]>(
      []
    );

  const [
    programOfferingSummary,
    setProgramOfferingSummary,
  ] =
    useState<
      NonNullable<
        ApiResponse["programOfferingSummary"]
      >
    >([]);
  const [
    summary,
    setSummary,
  ] =
    useState<
      ApiResponse["summary"] | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    finalizingOfferingId,
    setFinalizingOfferingId,
  ] =
    useState<number | null>(
      null
    );

  const [
    workflowMessage,
    setWorkflowMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  async function loadReport(
    options?: {
      selectedBatchCode?: string;
      selectedProgramCode?: string;
      selectedViewMode?: ViewMode;
      selectedScheduleKind?: string;
    }
  ) {
    if (!termName) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const qs =
        new URLSearchParams();

      qs.set(
        "termName",
        termName
      );

      qs.set(
        "viewMode",
        options?.selectedViewMode ||
          viewMode
      );

      qs.set(
        "scheduleKind",
        options?.selectedScheduleKind ||
          scheduleKind
      );

      const effectiveBatch =
        options?.selectedBatchCode !==
        undefined
          ? options.selectedBatchCode
          : batchCode;

      const effectiveProgram =
        options?.selectedProgramCode !==
        undefined
          ? options.selectedProgramCode
          : programCode;

      if (effectiveBatch) {
        qs.set(
          "batchCode",
          effectiveBatch
        );
      }

      if (effectiveProgram) {
        qs.set(
          "programCode",
          effectiveProgram
        );
      }

      const res =
        await fetch(
          `/api/admin/reports/batch-routine?${qs.toString()}`,
          {
            cache:
              "no-store",
          }
        );

      const json: ApiResponse =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json.error ||
            "Failed to load batch schedule."
        );
      }

      setBatchOptions(
        json.batchOptions || []
      );

      setProgramOptions(
        json.programOptions || []
      );

      setRows(
        json.rows || []
      );

      setProgramOfferingSummary(
        json.programOfferingSummary || []
      );

      setSummary(
        json.summary ||
          null
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load batch schedule."
      );

      setBatchOptions(
        []
      );

      setProgramOptions(
        []
      );

      setRows(
        []
      );

      setProgramOfferingSummary(
        []
      );

      setSummary(
        null
      );
    } finally {
      setLoading(false);
    }
  }

  async function finalizeDraft(
    offeringId: number
  ) {
    const ok =
      window.confirm(
        `Finalize offering ${offeringId}? This validates the draft and moves it to BUFFER_READY. Faculty choice will NOT open yet.`
      );

    if (!ok) {
      return;
    }

    setFinalizingOfferingId(
      offeringId
    );

    setError("");
    setWorkflowMessage("");

    try {
      const res =
        await fetch(
          `/api/offerings/drafts/${offeringId}/publish`,
          {
            method:
              "POST",
          }
        );

      const json =
        await res.json();

      if (!res.ok) {
        const blockers =
          Array.isArray(
            json.blockers
          )
            ? json.blockers.join(
                " | "
              )
            : "";

        throw new Error(
          blockers
            ? `${json.error || "Draft finalization failed."} ${blockers}`
            : json.error ||
                "Draft finalization failed."
        );
      }

      setWorkflowMessage(
        json.message ||
          `Offering ${offeringId} finalized successfully.`
      );

      await loadReport();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Draft finalization failed."
      );
    } finally {
      setFinalizingOfferingId(
        null
      );
    }
  }
  useEffect(() => {
    if (!termName) {
      return;
    }

    setBatchCode("");
    setProgramCode("");

    loadReport({
      selectedBatchCode:
        "",

      selectedProgramCode:
        "",
    });
  }, [
    termName,
  ]);

  async function changeViewMode(
    value: ViewMode
  ) {
    setViewMode(value);

    setBatchCode("");
    setProgramCode("");

    await loadReport({
      selectedBatchCode:
        "",

      selectedProgramCode:
        "",

      selectedViewMode:
        value,
    });
  }

  return (
    <AdminLayout title="Batch-wise Offering Schedule">
      <div className="space-y-6">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Batch-wise Draft Schedule
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Review all working draft offerings by batch before faculty choice is opened.
              Primary and secondary rows also expose current co-offering relationships.
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-5">

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Academic Term
              </label>

              <select
                value={
                  termName
                }
                onChange={(
                  e
                ) =>
                  setTermName(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                disabled={
                  loadingTerms
                }
              >
                <option value="">
                  {loadingTerms
                    ? "Loading terms..."
                    : "Select Academic Term"}
                </option>

                {terms.map(
                  (
                    term
                  ) => (
                    <option
                      key={
                        term.name
                      }
                      value={
                        term.name
                      }
                    >
                      {
                        term.name
                      }
                    </option>
                  )
                )}
              </select>
            </div>


            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                View
              </label>

              <select
                value={
                  viewMode
                }
                onChange={(
                  e
                ) =>
                  changeViewMode(
                    e.target
                      .value as ViewMode
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="DRAFT">
                  Working Drafts
                </option>

                <option value="FINAL">
                  Faculty Choice / Final
                </option>

                <option value="ALL">
                  All Offering States
                </option>
              </select>
            </div>


            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Program
              </label>

              <select
                value={
                  programCode
                }
                onChange={(
                  e
                ) => {
                  const value =
                    e.target
                      .value;

                  setProgramCode(
                    value
                  );

                  setBatchCode(
                    ""
                  );

                  loadReport({
                    selectedProgramCode:
                      value,

                    selectedBatchCode:
                      "",
                  });
                }}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">
                  All Programs
                </option>

                {programOptions.map(
                  (
                    option
                  ) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </option>
                  )
                )}
              </select>
            </div>


            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Batch
              </label>

              <select
                value={
                  batchCode
                }
                onChange={(
                  e
                ) => {
                  const value =
                    e.target
                      .value;

                  setBatchCode(
                    value
                  );

                  loadReport({
                    selectedBatchCode:
                      value,
                  });
                }}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">
                  All Batches
                </option>

                {batchOptions.map(
                  (
                    option
                  ) => (
                    <option
                      key={
                        option
                      }
                      value={
                        option
                      }
                    >
                      {
                        option
                      }
                    </option>
                  )
                )}
              </select>
            </div>


            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Schedule Type
              </label>

              <select
                value={
                  scheduleKind
                }
                onChange={(
                  e
                ) => {
                  const value =
                    e.target
                      .value;

                  setScheduleKind(
                    value
                  );

                  loadReport({
                    selectedScheduleKind:
                      value,
                  });
                }}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="ALL">
                  All Types
                </option>

                <option value="CLASS">
                  Theory / Class
                </option>

                <option value="LAB">
                  Lab / Sessional
                </option>

                <option value="PROJECT">
                  Project / Thesis
                </option>
              </select>
            </div>

          </div>


          <div className="mt-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  loadReport()
                }
                disabled={
                  !termName ||
                  loading
                }
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {loading
                  ? "Loading..."
                  : "Refresh Schedule"}
              </button>

              <a
                href={`/admin/co-offering-setup?termName=${encodeURIComponent(
                  termName || ""
                )}`}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-700"
              >
                Co-offering Setup
              </a>

              <a
                href="/admin/offering-drafts"
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Draft Manager
              </a>

              <a
                href="/admin/faculty-choice-control"
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Faculty Choice Control
              </a>
            </div>
          </div>

        </div>


        {(error ||
          termError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error ||
              termError}
          </div>
        )}

        {workflowMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {workflowMessage}
          </div>
        )}


        {programOfferingSummary.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Program-wise Offering Load Summary
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  Unique offered courses are counted once even when a course has multiple classes or lab slots.
                  The calculation follows the selected academic term, offering view, program and batch.
                </p>
              </div>

              <div className="text-xs text-slate-500">
                Schedule Type filter does not reduce these totals.
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-3 py-3 text-left">
                      Program
                    </th>

                    <th className="border-b px-3 py-3 text-center">
                      Total Courses
                    </th>

                    <th className="border-b px-3 py-3 text-center">
                      Total Credits
                    </th>

                    <th className="border-b px-3 py-3 text-center">
                      Theory Courses
                    </th>

                    <th className="border-b px-3 py-3 text-center">
                      Theory Credits
                    </th>

                    <th className="border-b px-3 py-3 text-center">
                      Lab Courses
                    </th>

                    <th className="border-b px-3 py-3 text-center">
                      Lab Credits
                    </th>

                    <th className="border-b px-3 py-3 text-center">
                      Project Courses
                    </th>

                    <th className="border-b px-3 py-3 text-center">
                      Project Credits
                    </th>

                    <th className="border-b px-3 py-3 text-center">
                      Co-offered Secondary
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {programOfferingSummary.map(
                    (item) => (
                      <tr
                        key={item.programCode}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">
                            {item.programLabel}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {item.programCode}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-center font-semibold">
                          {item.totalCourses}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className="rounded-full bg-slate-900 px-3 py-1 font-bold text-white">
                            {item.totalCredits}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center">
                          {item.theoryCourses}
                        </td>

                        <td className="px-3 py-3 text-center font-medium text-blue-700">
                          {item.theoryCredits}
                        </td>

                        <td className="px-3 py-3 text-center">
                          {item.labCourses}
                        </td>

                        <td className="px-3 py-3 text-center font-medium text-violet-700">
                          {item.labCredits}
                        </td>

                        <td className="px-3 py-3 text-center">
                          {item.projectCourses}
                        </td>

                        <td className="px-3 py-3 text-center font-medium text-emerald-700">
                          {item.projectCredits}
                        </td>

                        <td className="px-3 py-3 text-center">
                          {item.secondaryCourses}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Overall Credits
                </div>

                <div className="mt-1 text-xl font-bold text-slate-900">
                  {Number(
                    programOfferingSummary
                      .reduce(
                        (sum, item) =>
                          sum +
                          item.totalCredits,
                        0
                      )
                      .toFixed(2)
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Theory Courses
                </div>

                <div className="mt-1 text-xl font-bold text-blue-900">
                  {programOfferingSummary.reduce(
                    (sum, item) =>
                      sum +
                      item.theoryCourses,
                    0
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-violet-600">
                  Lab Courses
                </div>

                <div className="mt-1 text-xl font-bold text-violet-900">
                  {programOfferingSummary.reduce(
                    (sum, item) =>
                      sum +
                      item.labCourses,
                    0
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Project Courses
                </div>

                <div className="mt-1 text-xl font-bold text-emerald-900">
                  {programOfferingSummary.reduce(
                    (sum, item) =>
                      sum +
                      item.projectCourses,
                    0
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {summary && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex flex-wrap gap-3 text-sm">

              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                Rows:{" "}
                {
                  summary.totalRows
                }
              </span>

              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                Batches:{" "}
                {
                  summary.totalBatches
                }
              </span>

              <span className="rounded-full bg-cyan-100 px-3 py-1 font-medium text-cyan-800">
                Programs:{" "}
                {
                  summary.totalPrograms
                }
              </span>

              <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                Draft Rows:{" "}
                {
                  summary.draftRows
                }
              </span>

              <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">
                Faculty Choice / Final:{" "}
                {
                  summary.finalRows
                }
              </span>

              <span className="rounded-full bg-violet-100 px-3 py-1 font-medium text-violet-800">
                Co-offering Rows:{" "}
                {
                  summary.coOfferingRows
                }
              </span>

            </div>

          </div>
        )}


        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">

          <table className="min-w-full text-sm">

            <thead className="bg-slate-50">

              <tr>
                <th className="border-b px-3 py-3 text-left">
                  Batch
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Day
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Time
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Room
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Program
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Course
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Section
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Co-offering
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Faculty
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Status
                </th>

                <th className="border-b px-3 py-3 text-left">
                  IDs
                </th>

                <th className="border-b px-3 py-3 text-left">
                  Action
                </th>
              </tr>

            </thead>


            <tbody>

              {rows.map(
                (
                  row,
                  index
                ) => (
                  <tr
                    key={`${row.offeredCourseId}-${row.dayOfWeek}-${row.startTime}-${index}`}
                    className={
                      row.role ===
                      "SECONDARY"
                        ? "bg-violet-50"
                        : ""
                    }
                  >

                    <td className="border-b px-3 py-2 font-medium text-slate-900">
                      {
                        row.batchCode
                      }
                    </td>

                    <td className="border-b px-3 py-2">
                      {
                        row.dayOfWeek
                      }
                    </td>

                    <td className="border-b px-3 py-2 whitespace-nowrap">
                      {
                        row.startTime
                      }{" "}
                      -{" "}
                      {
                        row.endTime
                      }
                    </td>

                    <td className="border-b px-3 py-2">
                      {
                        row.roomCode
                      }
                    </td>

                    <td className="border-b px-3 py-2">
                      <div className="font-medium text-slate-900">
                        {
                          row.programLabel
                        }
                      </div>
                    </td>

                    <td className="border-b px-3 py-2">
                      <div className="font-medium text-slate-900">
                        {
                          row.courseCode
                        }
                      </div>

                      <div className="text-xs text-slate-500">
                        {
                          row.courseTitle
                        }
                      </div>
                    </td>

                    <td className="border-b px-3 py-2">
                      {
                        row.section
                      }
                    </td>

                    <td className="border-b px-3 py-2">

                      {row.role ===
                      "SECONDARY" ? (
                        <div>
                          <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800">
                            Secondary
                          </span>

                          <div className="mt-1 text-xs text-slate-500">
                            Primary:{" "}
                            {
                              row.primaryReference
                            }
                          </div>
                        </div>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          Primary
                        </span>
                      )}

                    </td>

                    <td className="border-b px-3 py-2">
                      {
                        row.facultyText
                      }
                    </td>

                    <td className="border-b px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(
                          row.offeringStatus
                        )}`}
                      >
                        {statusLabel(
                          row.offeringStatus
                        )}
                      </span>
                    </td>

                    <td className="border-b px-3 py-2 text-xs text-slate-500">
                      O:
                      {
                        row.offeringId
                      }
                      <br />
                      OC:
                      {
                        row.offeredCourseId
                      }
                    </td>

                    <td className="border-b px-3 py-2">
                      <div className="flex min-w-[190px] flex-col gap-2">

                        {row.role ===
                        "PRIMARY" ? (
                          <a
                            href={`/admin/co-offering-setup?termName=${encodeURIComponent(
                              termName || ""
                            )}&primaryProgramCode=${encodeURIComponent(
                              row.programCode
                            )}&primaryOfferedCourseId=${encodeURIComponent(
                              String(
                                row.offeredCourseId
                              )
                            )}`}
                            className="inline-flex justify-center rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700"
                          >
                            Co-offer
                          </a>
                        ) : (
                          <a
                            href={`/admin/co-offering-setup?termName=${encodeURIComponent(
                              termName || ""
                            )}`}
                            className="inline-flex justify-center rounded-lg bg-slate-600 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
                          >
                            Manage Co-offering
                          </a>
                        )}

                        {row.role ===
                          "PRIMARY" &&
                        row.offeringStatus ===
                          "DRAFT" && (
                          <button
                            type="button"
                            onClick={() =>
                              finalizeDraft(
                                row.offeringId
                              )
                            }
                            disabled={
                              finalizingOfferingId ===
                              row.offeringId
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {finalizingOfferingId ===
                            row.offeringId
                              ? "Finalizing..."
                              : "Finalize Draft"}
                          </button>
                        )}

                        {row.offeringStatus ===
                          "BUFFER_READY" && (
                          <a
                            href="/admin/faculty-choice-control"
                            className="inline-flex justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            Ready → Faculty Choice
                          </a>
                        )}

                        {row.offeringStatus ===
                          "FACULTY_CHOICE_BUFFER" && (
                          <span className="rounded-lg bg-violet-100 px-3 py-2 text-center text-xs font-medium text-violet-800">
                            Faculty Choice Open
                          </span>
                        )}

                        {row.offeringStatus ===
                          "FACULTY_CHOICE_FINALIZED" && (
                          <span className="rounded-lg bg-indigo-100 px-3 py-2 text-center text-xs font-medium text-indigo-800">
                            Faculty Choice Finalized
                          </span>
                        )}

                        {row.offeringStatus ===
                          "CONFIRMED" && (
                          <span className="rounded-lg bg-emerald-100 px-3 py-2 text-center text-xs font-medium text-emerald-800">
                            Confirmed
                          </span>
                        )}

                      </div>
                    </td>

                  </tr>
                )
              )}


              {rows.length ===
                0 &&
                !loading && (
                  <tr>
                    <td
                      colSpan={
                        12
                      }
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No offering schedule rows found for the selected view.
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

"use client";

import { useEffect, useMemo, useState } from "react";

type Term = {
  id: number;
  name: string;
  year: number;
  term_type: string;
};

type ProgramOption = {
  programCode: string;
  displayLabel: string;
};

type BatchOption = {
  id: number;
  batchCode: string;
  admissionTerm: string | null;
};

type ReportTab =
  | "COMBINED"
  | "BATCH"
  | "PROGRAM"
  | "DAY"
  | "CLASS_LAB"
  | "FACULTY_ROUTINE"
  | "ROOM"
  | "FACULTY_LOAD"
  | "FACULTY_LOAD_TAKEN"
  | "OFFERING_SUMMARY";

const tabs: Array<{ key: ReportTab; label: string }> = [
  { key: "COMBINED", label: "Combined Routine" },
  { key: "PROGRAM", label: "Program-wise Routine" },
  { key: "BATCH", label: "Batch-wise Routine" },
  { key: "DAY", label: "Day-wise Routine" },
  { key: "CLASS_LAB", label: "Class / Lab Schedule" },
  { key: "FACULTY_ROUTINE", label: "Faculty-wise Routine" },
  { key: "ROOM", label: "Room-wise Schedule" },
  { key: "FACULTY_LOAD", label: "Faculty Load Combined" },
  { key: "FACULTY_LOAD_TAKEN", label: "Faculty Load Taken" },
  { key: "OFFERING_SUMMARY", label: "Offering Summary" },
];

function buildQuery(params: Record<string, string>) {
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value.trim()) qs.set(key, value.trim());
  });

  return qs.toString();
}

function getReportApi(tab: ReportTab) {
  switch (tab) {
    case "BATCH":
      return "/api/admin/reports/batch-routine";
    case "PROGRAM":
      return "/api/admin/reports/confirmed-schedule";
    case "DAY":
      return "/api/admin/reports/day-wise-routine";
    case "CLASS_LAB":
      return "/api/admin/reports/class-lab-schedule";
    case "FACULTY_ROUTINE":
      return "/api/admin/reports/faculty-wise-routine";
    case "ROOM":
      return "/api/admin/reports/room-schedule";
    case "FACULTY_LOAD":
    case "FACULTY_LOAD_TAKEN":
      return "/api/admin/reports/faculty-load";
    case "OFFERING_SUMMARY":
      return "/api/admin/reports/offering-summary";
    case "COMBINED":
    default:
      return "/api/admin/reports/confirmed-schedule";
  }
}

function getExportUrl(tab: ReportTab, params: Record<string, string>) {
  const query = buildQuery(params);

  switch (tab) {
    case "BATCH":
      return `/api/export/batch-wise-routine?${query}`;
    case "PROGRAM":
      return `/api/export/program-wise-routine?${query}`;
    case "ROOM":
      return `/api/export/room-wise-schedule?${query}`;
    case "FACULTY_ROUTINE":
      return `/api/export/faculty-wise-routine?${query}`;
    case "FACULTY_LOAD":
      return `/api/export/faculty-load-combined?${query}`;
    case "FACULTY_LOAD_TAKEN":
      return `/api/export/faculty-load-taken?${query}`;
    case "OFFERING_SUMMARY":
      return `/api/export/offering-summary?${query}`;
    case "CLASS_LAB":
    case "DAY":
    case "COMBINED":
    default:
      return `/api/export/combined-routine?${query}`;
  }
}

function getRowsFromResponse(tab: ReportTab, data: any): any[] {
  if (tab === "FACULTY_LOAD" || tab === "FACULTY_LOAD_TAKEN") {
    return data.rows || [];
  }

  if (tab === "DAY" && Array.isArray(data.groups)) {
    return data.groups.flatMap((group: any) =>
      (group.rows || []).map((row: any) => ({
        ...row,
        dayGroup: group.dayOfWeek,
      }))
    );
  }

  if (tab === "CLASS_LAB" && data.groups) {
    return [
      ...(data.groups.classRows || []),
      ...(data.groups.labRows || []),
      ...(data.groups.projectRows || []),
    ];
  }

  return data.rows || [];
}

function SummaryCards({ summary }: { summary: any }) {
  if (!summary) return null;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Object.entries(summary).map(([key, value]) => (
        <div key={key} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {key.replace(/([A-Z])/g, " $1")}
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {String(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoutineTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="border-b px-3 py-3 text-left">Day</th>
            <th className="border-b px-3 py-3 text-left">Time</th>
            <th className="border-b px-3 py-3 text-left">Room</th>
            <th className="border-b px-3 py-3 text-left">Program</th>
            <th className="border-b px-3 py-3 text-left">Batch</th>
            <th className="border-b px-3 py-3 text-left">Course</th>
            <th className="border-b px-3 py-3 text-left">Section</th>
            <th className="border-b px-3 py-3 text-left">Credit</th>
            <th className="border-b px-3 py-3 text-left">Faculty</th>
            <th className="border-b px-3 py-3 text-left">Type</th>
            <th className="border-b px-3 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.offeredCourseId || row.courseCode}-${index}`}>
              <td className="border-b px-3 py-2">{row.dayOfWeek || "-"}</td>
              <td className="border-b px-3 py-2">
                {row.startTime || "-"} - {row.endTime || "-"}
              </td>
              <td className="border-b px-3 py-2">{row.roomCode || "-"}</td>
              <td className="border-b px-3 py-2">{row.programCode || "-"}</td>
              <td className="border-b px-3 py-2">
                {Array.isArray(row.batchCodes)
                  ? row.batchCodes.join(", ")
                  : row.batchCode || "-"}
              </td>
              <td className="border-b px-3 py-2">
                <span className="font-medium">{row.courseCode || "-"}</span>
                <br />
                <span className="text-slate-600">{row.courseTitle || "-"}</span>
              </td>
              <td className="border-b px-3 py-2">{row.section || "-"}</td>
              <td className="border-b px-3 py-2">{row.credit ?? "-"}</td>
              <td className="border-b px-3 py-2">{row.facultyText || "-"}</td>
              <td className="border-b px-3 py-2">{row.scheduleKind || "-"}</td>
              <td className="border-b px-3 py-2">{row.offeringStatus || "-"}</td>
            </tr>
          ))}

          {!rows.length ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                No rows found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function FacultyLoadTable({ rows, detailed }: { rows: any[]; detailed?: boolean }) {
  if (detailed) {
    const flattened = rows.flatMap((faculty) =>
      (faculty.assignedCourses || []).map((course: any) => ({
        faculty,
        course,
      }))
    );

    return (
      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="border-b px-3 py-3 text-left">Faculty</th>
              <th className="border-b px-3 py-3 text-left">Program</th>
              <th className="border-b px-3 py-3 text-left">Batch</th>
              <th className="border-b px-3 py-3 text-left">Course</th>
              <th className="border-b px-3 py-3 text-left">Section</th>
              <th className="border-b px-3 py-3 text-left">Credit</th>
              <th className="border-b px-3 py-3 text-left">Load Type</th>
              <th className="border-b px-3 py-3 text-left">Schedule</th>
              <th className="border-b px-3 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {flattened.map((item, index) => (
              <tr key={`${item.faculty.teacherCode}-${item.course.offeredCourseId}-${index}`}>
                <td className="border-b px-3 py-2">
                  {item.faculty.teacherCode} - {item.faculty.teacherName}
                </td>
                <td className="border-b px-3 py-2">{item.course.programCode}</td>
                <td className="border-b px-3 py-2">
                  {(item.course.batchCodes || []).join(", ") || "-"}
                </td>
                <td className="border-b px-3 py-2">
                  <span className="font-medium">{item.course.courseCode}</span>
                  <br />
                  <span className="text-slate-600">{item.course.courseTitle}</span>
                </td>
                <td className="border-b px-3 py-2">{item.course.section}</td>
                <td className="border-b px-3 py-2">{item.course.assignedCredit}</td>
                <td className="border-b px-3 py-2">{item.course.loadType}</td>
                <td className="border-b px-3 py-2">{item.course.scheduleText}</td>
                <td className="border-b px-3 py-2">{item.course.offeringStatus}</td>
              </tr>
            ))}

            {!flattened.length ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No faculty load rows found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="border-b px-3 py-3 text-left">Initial</th>
            <th className="border-b px-3 py-3 text-left">Faculty</th>
            <th className="border-b px-3 py-3 text-left">Designation</th>
            <th className="border-b px-3 py-3 text-left">Department</th>
            <th className="border-b px-3 py-3 text-left">Seniority</th>
            <th className="border-b px-3 py-3 text-left">Theory</th>
            <th className="border-b px-3 py-3 text-left">Lab</th>
            <th className="border-b px-3 py-3 text-left">Project</th>
            <th className="border-b px-3 py-3 text-left">Total</th>
            <th className="border-b px-3 py-3 text-left">Phone</th>
            <th className="border-b px-3 py-3 text-left">Email</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teacherId}>
              <td className="border-b px-3 py-2">{row.teacherCode}</td>
              <td className="border-b px-3 py-2">{row.teacherName}</td>
              <td className="border-b px-3 py-2">{row.designation}</td>
              <td className="border-b px-3 py-2">{row.departmentCode}</td>
              <td className="border-b px-3 py-2">{row.seniorityLevel ?? "-"}</td>
              <td className="border-b px-3 py-2">{row.theoryCredits}</td>
              <td className="border-b px-3 py-2">{row.labCredits}</td>
              <td className="border-b px-3 py-2">{row.projectCredits}</td>
              <td className="border-b px-3 py-2 font-semibold">{row.totalCredits}</td>
              <td className="border-b px-3 py-2">{row.phone}</td>
              <td className="border-b px-3 py-2">{row.email}</td>
            </tr>
          ))}

          {!rows.length ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                No faculty load rows found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function OfferingSummaryTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="border-b px-3 py-3 text-left">Status</th>
            <th className="border-b px-3 py-3 text-left">Role</th>
            <th className="border-b px-3 py-3 text-left">Program</th>
            <th className="border-b px-3 py-3 text-left">Batch</th>
            <th className="border-b px-3 py-3 text-left">Course</th>
            <th className="border-b px-3 py-3 text-left">Section</th>
            <th className="border-b px-3 py-3 text-left">Credit</th>
            <th className="border-b px-3 py-3 text-left">Faculty</th>
            <th className="border-b px-3 py-3 text-left">Schedule</th>
            <th className="border-b px-3 py-3 text-left">Co-offered With</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.offeredCourseId}-${index}`}>
              <td className="border-b px-3 py-2">{row.offeringStatus}</td>
              <td className="border-b px-3 py-2">{row.role}</td>
              <td className="border-b px-3 py-2">{row.programCode}</td>
              <td className="border-b px-3 py-2">
                {(row.batchCodes || []).join(", ") || "-"}
              </td>
              <td className="border-b px-3 py-2">
                <span className="font-medium">{row.courseCode}</span>
                <br />
                <span className="text-slate-600">{row.courseTitle}</span>
              </td>
              <td className="border-b px-3 py-2">{row.section}</td>
              <td className="border-b px-3 py-2">{row.credit}</td>
              <td className="border-b px-3 py-2">{row.facultyText}</td>
              <td className="border-b px-3 py-2">{row.scheduleText}</td>
              <td className="border-b px-3 py-2">{row.coOfferedCourseText}</td>
            </tr>
          ))}

          {!rows.length ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                No offering summary rows found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPageClient() {
  const [activeTab, setActiveTab] = useState<ReportTab>("COMBINED");

  const [terms, setTerms] = useState<Term[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);

  const [termName, setTermName] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [scheduleKind, setScheduleKind] = useState("ALL");
  const [teacherCode, setTeacherCode] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);

  async function loadInitialOptions() {
    setLoadingOptions(true);

    try {
      const [termsRes, programsRes] = await Promise.all([
        fetch("/api/academic-terms/list", { cache: "no-store" }),
        fetch("/api/academic-catalog/options", { cache: "no-store" }),
      ]);

      const termsJson = await termsRes.json();
      const programsJson = await programsRes.json();

      const loadedTerms: Term[] = termsJson.terms || [];
      const loadedPrograms: ProgramOption[] = programsJson.programs || [];

      setTerms(loadedTerms);
      setPrograms(loadedPrograms);

      if (!termName && loadedTerms.length > 0) {
        setTermName(loadedTerms[0].name);
      }
    } catch {
      setTerms([]);
      setPrograms([]);
    } finally {
      setLoadingOptions(false);
    }
  }

  async function loadBatches(program: string) {
    setBatchCode("");

    if (!program) {
      setBatches([]);
      return;
    }

    try {
      const res = await fetch(
        `/api/program-batches/options?programCode=${encodeURIComponent(program)}`,
        { cache: "no-store" }
      );
      const json = await res.json();

      setBatches(json.batches || []);
    } catch {
      setBatches([]);
    }
  }

  useEffect(() => {
    loadInitialOptions();
  }, []);

  useEffect(() => {
    loadBatches(programCode);
  }, [programCode]);

  const queryParams = useMemo(
    () => ({
      termName,
      programCode,
      batchCode,
      scheduleKind,
      teacherCode,
      roomCode,
    }),
    [termName, programCode, batchCode, scheduleKind, teacherCode, roomCode]
  );

  async function loadReport() {
    if (!termName) {
      setError("Please select an academic term first.");
      return;
    }

    setLoading(true);
    setError("");
    setSummary(null);
    setRows([]);

    try {
      const api = getReportApi(activeTab);
      const qs = buildQuery(queryParams);

      const res = await fetch(`${api}?${qs}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load report.");
      }

      setSummary(json.summary || null);
      setRows(getRowsFromResponse(activeTab, json));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report.");
      setSummary(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (termName) {
      loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const exportUrl = getExportUrl(activeTab, queryParams);

  const isFacultyLoadTab =
    activeTab === "FACULTY_LOAD" || activeTab === "FACULTY_LOAD_TAKEN";

  const isOfferingSummaryTab = activeTab === "OFFERING_SUMMARY";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Professional Reporting Center
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Preview and export combined, program-wise, batch-wise, class, lab,
              room, faculty, load, and offering reports.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadReport}
              disabled={loading || !termName}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh Preview"}
            </button>

            <a
              href={exportUrl}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Export Excel
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Academic Term
            </label>
            <select
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
              disabled={loadingOptions}
              className="w-full rounded-xl border px-3 py-3 text-sm"
            >
              <option value="">Select Term</option>
              {terms.map((term) => (
                <option key={term.id} value={term.name}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Program
            </label>
            <select
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              className="w-full rounded-xl border px-3 py-3 text-sm"
            >
              <option value="">All Programs</option>
              {programs.map((program) => (
                <option key={program.programCode} value={program.programCode}>
                  {program.displayLabel || program.programCode}
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
              className="w-full rounded-xl border px-3 py-3 text-sm"
              disabled={!programCode}
            >
              <option value="">All Batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.batchCode}>
                  {batch.batchCode}
                  {batch.admissionTerm ? ` | ${batch.admissionTerm}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Schedule Type
            </label>
            <select
              value={scheduleKind}
              onChange={(e) => setScheduleKind(e.target.value)}
              className="w-full rounded-xl border px-3 py-3 text-sm"
            >
              <option value="ALL">All</option>
              <option value="CLASS">Class</option>
              <option value="LAB">Lab</option>
              <option value="PROJECT">Project / No Slot</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Faculty Initial
            </label>
            <input
              value={teacherCode}
              onChange={(e) => setTeacherCode(e.target.value.toUpperCase())}
              placeholder="AAM"
              className="w-full rounded-xl border px-3 py-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Room Code
            </label>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="CLS 408"
              className="w-full rounded-xl border px-3 py-3 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <SummaryCards summary={summary} />

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Current Preview: <span className="font-semibold">{rows.length}</span>{" "}
        rows. Export button uses the same filters.
      </div>

      {isFacultyLoadTab ? (
        <FacultyLoadTable rows={rows} detailed={activeTab === "FACULTY_LOAD_TAKEN"} />
      ) : isOfferingSummaryTab ? (
        <OfferingSummaryTable rows={rows} />
      ) : (
        <RoutineTable rows={rows} />
      )}
    </div>
  );
}
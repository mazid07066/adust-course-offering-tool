"use client";

import UniFlowLogo from "@/components/uniflow-logo";

import { useEffect, useMemo, useState } from "react";

type FacultyDetail = {
  id: number;
  teacherCode: string;
  fullName: string;
  designation: string;
  phone: string;
  email: string;
};

type ScheduleRow = {
  batchCode: string;
  programCode: string;
  programName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  facultyText: string;
  facultyDetails: FacultyDetail[];
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  scheduleKind: string;
  offeringStatus: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  terms?: string[];
  filters?: {
    programs: string[];
    batches: string[];
    days: string[];
  };
  rows?: ScheduleRow[];
};

const PROGRAM_LABELS: Record<string, string> = {
  "BSC-EEE-EVE-NEW": "B.Sc. in EEE (Evening/Diploma Holders)",
  "BSC-EEE-REG-NEW": "B.Sc. in EEE (Regular)",
  "BSC-RAE-REG-NEW": "B.Sc. in RAE",
};

const DAY_ORDER: Record<string, number> = {
  SATURDAY: 1,
  SUNDAY: 2,
  MONDAY: 3,
  TUESDAY: 4,
  WEDNESDAY: 5,
  THURSDAY: 6,
  FRIDAY: 7,
  "-": 99,
};

function getProgramLabel(programCode: string) {
  return PROGRAM_LABELS[programCode] || "Academic Program";
}

function groupKey(row: ScheduleRow) {
  return `${row.programCode}__${row.batchCode}`;
}

function sortRows(a: ScheduleRow, b: ScheduleRow) {
  const dayA = DAY_ORDER[String(a.dayOfWeek || "").toUpperCase()] ?? 98;
  const dayB = DAY_ORDER[String(b.dayOfWeek || "").toUpperCase()] ?? 98;

  if (dayA !== dayB) return dayA - dayB;
  if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
  return a.courseCode.localeCompare(b.courseCode);
}

function uniqueFaculty(rows: ScheduleRow[]) {
  const map = new Map<number, FacultyDetail>();

  for (const row of rows) {
    for (const faculty of row.facultyDetails || []) {
      if (!map.has(faculty.id)) {
        map.set(faculty.id, faculty);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.teacherCode.localeCompare(b.teacherCode)
  );
}

export default function PublicSchedulePageClient() {
  const [terms, setTerms] = useState<string[]>([]);
  const [termName, setTermName] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");

  const [filters, setFilters] = useState<{
    programs: string[];
    batches: string[];
    days: string[];
  }>({
    programs: [],
    batches: [],
    days: [],
  });

  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");

  async function loadTerms() {
    setLoadingTerms(true);
    setError("");

    try {
      const res = await fetch("/api/public/schedule", { cache: "no-store" });
      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load academic terms.");
      }

      setTerms(json.terms || []);
      setFilters(json.filters || { programs: [], batches: [], days: [] });

      if (!termName && json.terms?.length) {
        setTermName(json.terms[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load academic terms."
      );
    } finally {
      setLoadingTerms(false);
    }
  }

  async function loadRows() {
    if (!termName) return;

    setLoadingRows(true);
    setError("");

    try {
      const qs = new URLSearchParams();
      qs.set("termName", termName);

      if (programCode) qs.set("programCode", programCode);
      if (batchCode) qs.set("batchCode", batchCode);
      if (dayOfWeek) qs.set("dayOfWeek", dayOfWeek);

      const res = await fetch(`/api/public/schedule?${qs.toString()}`, {
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load schedule.");
      }

      setFilters(json.filters || { programs: [], batches: [], days: [] });
      setRows(json.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule.");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (termName) {
      loadRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termName, programCode, batchCode, dayOfWeek]);

  const groupedRoutines = useMemo(() => {
    const map = new Map<
      string,
      {
        programCode: string;
        programName: string;
        batchCode: string;
        rows: ScheduleRow[];
        faculty: FacultyDetail[];
      }
    >();

    for (const row of rows) {
      const key = groupKey(row);

      if (!map.has(key)) {
        map.set(key, {
          programCode: row.programCode,
          programName: row.programName,
          batchCode: row.batchCode,
          rows: [],
          faculty: [],
        });
      }

      map.get(key)?.rows.push(row);
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        rows: group.rows.sort(sortRows),
        faculty: uniqueFaculty(group.rows),
      }))
      .sort((a, b) => {
        if (a.programCode !== b.programCode) {
          return a.programCode.localeCompare(b.programCode);
        }

        return a.batchCode.localeCompare(b.batchCode);
      });
  }, [rows]);

  return (
    <main className="min-h-screen bg-[#f4f8fc] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-[#079db8]/20 bg-white shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0867b2] via-[#079db8] to-[#4dc21f]" />

          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <UniFlowLogo />

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#079db8]">
                  Official Public Schedule
                </p>

                <h1 className="mt-2 text-3xl font-black tracking-tight text-[#071b3c]">
                  Public Batch-wise Routine
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  View the official semester class and lab routine by academic
                  program, batch, and day.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#079db8]/20 bg-[#eafafb] px-5 py-4 text-sm text-[#071b3c]">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#079db8]">
                Official Semester
              </div>

              <div className="mt-1 text-lg font-black">
                {termName || "Schedule not released"}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Program Identification
          </h2>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-bold text-slate-900">
                BSC-EEE-EVE-NEW
              </div>
              <div className="mt-1 text-sm text-slate-600">
                B.Sc. in EEE (Evening/Diploma Holders)
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-bold text-slate-900">
                BSC-EEE-REG-NEW
              </div>
              <div className="mt-1 text-sm text-slate-600">
                B.Sc. in EEE (Regular)
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-bold text-slate-900">
                BSC-RAE-REG-NEW
              </div>
              <div className="mt-1 text-sm text-slate-600">
                B.Sc. in RAE
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Academic Term
              </label>
              <select
                value={termName}
                onChange={(e) => {
                  setTermName(e.target.value);
                  setProgramCode("");
                  setBatchCode("");
                  setDayOfWeek("");
                }}
                className="w-full rounded-xl border px-4 py-3"
                disabled={loadingTerms}
              >
                <option value="">
                  {loadingTerms ? "Loading terms..." : "Select Term"}
                </option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Program</label>
              <select
                value={programCode}
                onChange={(e) => {
                  setProgramCode(e.target.value);
                  setBatchCode("");
                  setDayOfWeek("");
                }}
                className="w-full rounded-xl border px-4 py-3"
                disabled={!termName}
              >
                <option value="">All Programs</option>
                {filters.programs.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Select a program first to load that program&apos;s batches.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Batch</label>
              <select
                value={batchCode}
                onChange={(e) => {
                  setBatchCode(e.target.value);
                  setDayOfWeek("");
                }}
                className="w-full rounded-xl border px-4 py-3"
                disabled={!termName || !programCode}
              >
                <option value="">
                  {programCode ? "Select Batch / All Batches" : "Select Program First"}
                </option>
                {filters.batches.map((batch) => (
                  <option key={batch} value={batch}>
                    {batch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                disabled={!termName}
              >
                <option value="">All Days</option>
                {filters.days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        {loadingRows ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
            Loading routine...
          </section>
        ) : null}

        {!loadingRows && groupedRoutines.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
            No finalized routine found for the selected filters.
          </section>
        ) : null}

        {!loadingRows &&
          groupedRoutines.map((group) => (
            <section
              key={`${group.programCode}-${group.batchCode}`}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-200 bg-slate-900 px-6 py-5 text-white">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">
                      {group.programCode} — {getProgramLabel(group.programCode)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      Batch: {group.batchCode}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/10 px-4 py-2 text-sm">
                    Total routine rows: {group.rows.length}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-3 text-left">Day</th>
                      <th className="border-b px-3 py-3 text-left">Time</th>
                      <th className="border-b px-3 py-3 text-left">Room</th>
                      <th className="border-b px-3 py-3 text-left">Course</th>
                      <th className="border-b px-3 py-3 text-left">Section</th>
                      <th className="border-b px-3 py-3 text-left">Type</th>
                      <th className="border-b px-3 py-3 text-left">Faculty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, index) => (
                      <tr
                        key={`${row.programCode}-${row.batchCode}-${row.courseCode}-${row.section}-${row.dayOfWeek}-${row.startTime}-${index}`}
                        className="hover:bg-slate-50"
                      >
                        <td className="border-b px-3 py-2 font-medium">
                          {row.dayOfWeek}
                        </td>
                        <td className="border-b px-3 py-2">
                          {row.startTime} - {row.endTime}
                        </td>
                        <td className="border-b px-3 py-2">{row.roomCode}</td>
                        <td className="border-b px-3 py-2">
                          <div className="font-semibold">{row.courseCode}</div>
                          <div className="text-xs text-slate-500">
                            {row.courseTitle}
                          </div>
                        </td>
                        <td className="border-b px-3 py-2">{row.section}</td>
                        <td className="border-b px-3 py-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {row.scheduleKind}
                          </span>
                        </td>
                        <td className="border-b px-3 py-2">
                          {row.facultyText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
                <h3 className="text-lg font-bold text-slate-900">
                  Faculty Members for Batch {group.batchCode}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Contact information of faculty members assigned to this
                  batch-wise routine.
                </p>

                {group.faculty.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No faculty details found for this batch routine.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.faculty.map((faculty) => (
                      <div
                        key={faculty.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="text-sm font-semibold text-blue-700">
                          {faculty.teacherCode}
                        </div>
                        <div className="mt-1 text-base font-bold text-slate-900">
                          {faculty.fullName}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {faculty.designation}
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-700">
                          <div>
                            <span className="font-semibold">Phone:</span>{" "}
                            {faculty.phone}
                          </div>
                          <div>
                            <span className="font-semibold">Email:</span>{" "}
                            {faculty.email}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}

        <footer className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          <div className="space-y-2">
            <div className="font-semibold text-slate-900">
              UniFlow Academic Planner
            </div>
            <div>
              Course Offering, Faculty Assignment, Scheduling and Reporting
              System
            </div>
            <div>
              Built with Next.js, React, TypeScript, Prisma ORM, PostgreSQL
              Supabase and Vercel Deployment.
            </div>
            <div className="font-semibold text-slate-900">
              Designed and Developed by Mazid Ishtique Ahmed
            </div>
            <div>
              Assistant Professor, EEE and Chairman, Dept. of Robotics and
              Automation Engineering, Atish Dipankar University of Science &
              Technology (ADUST)
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
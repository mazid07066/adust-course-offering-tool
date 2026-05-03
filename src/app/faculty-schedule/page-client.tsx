"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FacultyDetail = {
  id: number;
  teacherCode: string;
  fullName: string;
  designation: string;
  phone: string;
  email: string;
};

type FacultyRoutineRow = {
  faculty: FacultyDetail;
  programCode: string;
  programName: string;
  batchCodes: string[];
  courseCode: string;
  courseTitle: string;
  section: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  scheduleKind: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  terms?: string[];
  facultyOptions?: FacultyDetail[];
  dayOptions?: string[];
  rows?: FacultyRoutineRow[];
};

const PROGRAM_LABELS: Record<string, string> = {
  "BSC-EEE-EVE-NEW": "B.Sc. in EEE (Evening/Diploma Holders)",
  "BSC-EEE-REG-NEW": "B.Sc. in EEE (Regular)",
  "BSC-RAE-REG-NEW": "B.Sc. in RAE",
};

function groupRowsByFaculty(rows: FacultyRoutineRow[]) {
  const map = new Map<string, FacultyRoutineRow[]>();

  for (const row of rows) {
    const key = `${row.faculty.id}__${row.faculty.teacherCode}__${row.faculty.fullName}`;
    const existing = map.get(key) || [];
    existing.push(row);
    map.set(key, existing);
  }

  return Array.from(map.entries()).map(([key, items]) => {
    const [, teacherCode, fullName] = key.split("__");
    return {
      key,
      teacherCode,
      fullName,
      faculty: items[0].faculty,
      rows: items,
    };
  });
}

export default function FacultySchedulePageClient() {
  const [terms, setTerms] = useState<string[]>([]);
  const [termName, setTermName] = useState("");
  const [facultyOptions, setFacultyOptions] = useState<FacultyDetail[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [dayOptions, setDayOptions] = useState<string[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState("");

  const [rows, setRows] = useState<FacultyRoutineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const groupedRows = useMemo(() => groupRowsByFaculty(rows), [rows]);

  async function loadTerms() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/public/faculty-schedule", {
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load terms.");
      }

      const loadedTerms = json.terms || [];
      setTerms(loadedTerms);

      if (!termName && loadedTerms.length > 0) {
        setTermName(loadedTerms[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load terms.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSchedule() {
    if (!termName) return;

    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams();
      qs.set("termName", termName);

      if (teacherId) {
        qs.set("teacherId", teacherId);
      }

      if (dayOfWeek) {
        qs.set("dayOfWeek", dayOfWeek);
      }

      const res = await fetch(`/api/public/faculty-schedule?${qs.toString()}`, {
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load faculty schedule.");
      }

      setFacultyOptions(json.facultyOptions || []);
      setDayOptions(json.dayOptions || []);
      setRows(json.rows || []);
    } catch (err) {
      setRows([]);
      setFacultyOptions([]);
      setDayOptions([]);
      setError(
        err instanceof Error ? err.message : "Failed to load faculty schedule."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (termName) {
      void loadSchedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termName, teacherId, dayOfWeek]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-blue-700">
              UniFlow Academic Planner
            </p>
            <h1 className="mt-2 text-3xl font-black">
              Faculty-wise Public Routine
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              View confirmed class and lab schedules by faculty member.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            

            <Link
              href="/schedule"
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Student Routine
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8">

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
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
        
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Search Faculty Routine</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Academic Term
              </label>
              <select
                value={termName}
                onChange={(e) => {
                  setTermName(e.target.value);
                  setTeacherId("");
                  setDayOfWeek("");
                }}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">
                  {loading ? "Loading..." : "Select Academic Term"}
                </option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Faculty Member
              </label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">All Faculty</option>
                {facultyOptions.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.teacherCode} — {faculty.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">All Days</option>
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">Faculty Routine</h2>
              <p className="mt-1 text-sm text-slate-600">
                Showing confirmed schedule only.
              </p>
            </div>

            <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
              Total rows: {rows.length}
            </div>
          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl border bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Loading routine...
            </div>
          ) : null}

          {!loading && groupedRows.length === 0 ? (
            <div className="mt-8 rounded-2xl border bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No confirmed faculty routine found for the selected filters.
            </div>
          ) : null}

          <div className="mt-6 space-y-8">
            {groupedRows.map((group) => (
              <div key={group.key} className="overflow-hidden rounded-2xl border">
                <div className="bg-slate-950 px-5 py-4 text-white">
                  <h3 className="text-xl font-bold">
                    {group.faculty.teacherCode} — {group.faculty.fullName}
                  </h3>

                  <div className="mt-2 grid gap-1 text-sm text-slate-200 md:grid-cols-3">
                    <div>Designation: {group.faculty.designation || "-"}</div>
                    <div>Phone: {group.faculty.phone || "-"}</div>
                    <div>Email: {group.faculty.email || "-"}</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
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
                        <th className="border-b px-3 py-3 text-left">Type</th>
                      </tr>
                    </thead>

                    <tbody>
                      {group.rows.map((row, index) => (
                        <tr
                          key={`${row.faculty.id}-${row.courseCode}-${row.section}-${row.dayOfWeek}-${row.startTime}-${index}`}
                        >
                          <td className="border-b px-3 py-3 font-semibold">
                            {row.dayOfWeek}
                          </td>
                          <td className="border-b px-3 py-3">
                            {row.startTime} - {row.endTime}
                          </td>
                          <td className="border-b px-3 py-3">{row.roomCode}</td>
                          <td className="border-b px-3 py-3">
                            <div className="font-semibold">{row.programCode}</div>
                            <div className="text-xs text-slate-500">
                              {row.programName}
                            </div>
                          </td>
                          <td className="border-b px-3 py-3">
                            {row.batchCodes.join(", ") || "-"}
                          </td>
                          <td className="border-b px-3 py-3">
                            <div className="font-semibold">{row.courseCode}</div>
                            <div className="text-xs text-slate-500">
                              {row.courseTitle}
                            </div>
                          </td>
                          <td className="border-b px-3 py-3">{row.section}</td>
                          <td className="border-b px-3 py-3">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                              {row.scheduleKind}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

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
      </section>
    </main>
  );
}
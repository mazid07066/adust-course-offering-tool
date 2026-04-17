"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";

type FacultySummary = {
  id: string;
  initial: string;
  name: string;
  designation: string | null;
  departmentCode: string;
};

type FacultyLoadRow = {
  facultyId: string;
  initial: string;
  name: string;
  designation: string | null;
  departmentCode: string;
  phone: string | null;
  email: string | null;
  theoryLoad: number;
  labLoad: number;
  totalLoad: number;
};

type FacultyRoutineItem = {
  courseCode: string;
  coOfferedCourseCode: string | null;
  displayCourseCodes: string;
  courseTitle: string;
  section: string;
  batches: string;
  room: string;
  startTime: string;
  endTime: string;
};

type FacultyRoutineRow = {
  facultyId: string;
  initial: string;
  name: string;
  designation: string | null;
  departmentCode: string;
  phone: string | null;
  email: string | null;
  routine: Record<string, FacultyRoutineItem[]>;
};

type ResponseData = {
  success?: boolean;
  error?: string;
  semester?: string;
  faculties?: FacultySummary[];
  facultyLoadRows?: FacultyLoadRow[];
  facultyRoutines?: FacultyRoutineRow[];
};

const DAYS = ["SUN", "MON", "THU"];

export default function FacultyDashboardPage() {
  const [season, setSeason] = useState("summer");
  const [year, setYear] = useState("2026");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [data, setData] = useState<ResponseData | null>(null);

  async function loadFacultyDashboard() {
    const params = new URLSearchParams({
      season,
      year,
    });

    if (selectedFacultyId) {
      params.set("facultyId", selectedFacultyId);
    }

    const res = await fetch(`/api/faculty-dashboard?${params.toString()}`);
    const json = await res.json();
    setData(json);
  }

  function exportFacultyLoad() {
    window.location.href = `/api/export/faculty-load?season=${encodeURIComponent(
      season
    )}&year=${encodeURIComponent(year)}`;
  }

  function exportFacultyRoutine() {
    const params = new URLSearchParams({
      season,
      year,
    });

    if (selectedFacultyId) {
      params.set("facultyId", selectedFacultyId);
    }

    window.location.href = `/api/export/faculty-routine?${params.toString()}`;
  }

  const visibleRoutineRows = selectedFacultyId
    ? (data?.facultyRoutines ?? []).filter((item) => item.facultyId === selectedFacultyId)
    : data?.facultyRoutines ?? [];

  return (
    <AdminLayout title="Faculty Load & Routine Dashboard">
      <div className="grid gap-6">
        <div className="rounded-xl border p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="spring/summer/fall"
              className="rounded-lg border px-3 py-2"
            />
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2026"
              className="rounded-lg border px-3 py-2"
            />
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              className="rounded-lg border px-3 py-2"
            >
              <option value="">All Faculties</option>
              {(data?.faculties ?? []).map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.initial} - {faculty.name}
                </option>
              ))}
            </select>
            <button
              onClick={loadFacultyDashboard}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white"
            >
              Load Faculty Dashboard
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={exportFacultyLoad}
              className="rounded-lg border px-4 py-2"
            >
              Export Faculty Load
            </button>
            <button
              onClick={exportFacultyRoutine}
              className="rounded-lg border px-4 py-2"
            >
              Export Faculty Routine
            </button>
          </div>
        </div>

        {data?.success && (
          <>
            <div className="rounded-xl border p-4">
              <h2 className="mb-4 text-xl font-semibold">
                Faculty Load Sheet - {data.semester}
              </h2>

              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border px-3 py-2 text-left">Initial</th>
                      <th className="border px-3 py-2 text-left">Name</th>
                      <th className="border px-3 py-2 text-left">Designation</th>
                      <th className="border px-3 py-2 text-left">Department</th>
                      <th className="border px-3 py-2 text-left">Theory Load</th>
                      <th className="border px-3 py-2 text-left">Lab Load</th>
                      <th className="border px-3 py-2 text-left">Total Load</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.facultyLoadRows ?? [])
                      .filter((row) => !selectedFacultyId || row.facultyId === selectedFacultyId)
                      .map((row) => (
                        <tr key={row.facultyId}>
                          <td className="border px-3 py-2">{row.initial}</td>
                          <td className="border px-3 py-2">{row.name}</td>
                          <td className="border px-3 py-2">{row.designation ?? "-"}</td>
                          <td className="border px-3 py-2">{row.departmentCode}</td>
                          <td className="border px-3 py-2">{row.theoryLoad}</td>
                          <td className="border px-3 py-2">{row.labLoad}</td>
                          <td className="border px-3 py-2">{row.totalLoad}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {visibleRoutineRows.map((faculty) => (
              <div key={faculty.facultyId} className="rounded-xl border p-4">
                <h2 className="mb-2 text-xl font-semibold">
                  Faculty Routine - {faculty.initial} - {faculty.name}
                </h2>
                <p className="mb-4 text-sm text-slate-600">
                  {faculty.designation ?? "-"} | {faculty.departmentCode} | {faculty.phone ?? "-"} | {faculty.email ?? "-"}
                </p>

                {DAYS.map((day) => (
                  <div key={day} className="mb-6">
                    <h3 className="mb-2 text-lg font-semibold">{day}</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="border px-3 py-2 text-left">Time</th>
                            <th className="border px-3 py-2 text-left">Course Codes</th>
                            <th className="border px-3 py-2 text-left">Title</th>
                            <th className="border px-3 py-2 text-left">Section</th>
                            <th className="border px-3 py-2 text-left">Batch</th>
                            <th className="border px-3 py-2 text-left">Room</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(faculty.routine?.[day] ?? []).length > 0 ? (
                            (faculty.routine?.[day] ?? []).map((item, i) => (
                              <tr key={i}>
                                <td className="border px-3 py-2">
                                  {item.startTime} - {item.endTime}
                                </td>
                                <td className="border px-3 py-2">{item.displayCourseCodes}</td>
                                <td className="border px-3 py-2">{item.courseTitle}</td>
                                <td className="border px-3 py-2">{item.section}</td>
                                <td className="border px-3 py-2">{item.batches}</td>
                                <td className="border px-3 py-2">{item.room}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="border px-3 py-2" colSpan={6}>
                                No class
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {data?.error && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
            {data.error}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
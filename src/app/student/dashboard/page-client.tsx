"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type StudentDashboard = {
  id: number;
  student_id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  current_status: string;
  enrollments: Array<{
    curriculum_key?: string | null;
    admission_semester?: string | null;
    enrollment_status?: string | null;
    program: {
      short_name: string;
      name: string;
    };
    batches?: {
      batch_code: string;
    } | null;
  }>;
  advisor_assignments: Array<{
    teachers: {
      teacher_code: string;
      full_name: string;
      designation?: string | null;
    };
  }>;
};

export default function StudentDashboardClient() {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams.get("studentId") || "";

  const [studentId, setStudentId] = useState(initialStudentId);
  const [student, setStudent] = useState<StudentDashboard | null>(null);
  const [modules, setModules] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(targetId?: string) {
    const id = String(targetId || studentId || "").trim();

    if (!id) {
      setError("Enter a Student ID.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/student/dashboard?studentId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load dashboard.");
      }

      setStudent(json.student);
      setModules(json.modules || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      setStudent(null);
      setModules({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialStudentId) {
      loadDashboard(initialStudentId);
    }
  }, [initialStudentId]);

  const enrollment = student?.enrollments?.[0];
  const advisor = student?.advisor_assignments?.[0]?.teachers;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
                UniFlow Student Portal
              </p>
              <h1 className="mt-3 text-3xl font-bold">
                Student Dashboard Preview
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                S1-C preview dashboard for student identity and academic profile.
                Registration, billing, attendance, grades, admit cards, and results
                will be activated in later ERP phases.
              </p>
            </div>

            <Link
              href="/admin/students"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
            >
              Back to Student List
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              placeholder="Enter Student ID"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="flex-1 rounded-xl border px-4 py-3"
            />

            <button
              onClick={() => loadDashboard()}
              disabled={loading}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Open Dashboard"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {student && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                    {student.student_id}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {student.full_name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {enrollment?.program?.short_name || "-"} · Batch{" "}
                    {enrollment?.batches?.batch_code || "-"} ·{" "}
                    {enrollment?.curriculum_key || "No curriculum key"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                    {student.current_status}
                  </span>

                  <Link
                    href={`/admin/students/${student.id}`}
                    className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Edit Detail
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">Academic Profile</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div>Program: {enrollment?.program?.name || "-"}</div>
                  <div>Batch: {enrollment?.batches?.batch_code || "-"}</div>
                  <div>Curriculum: {enrollment?.curriculum_key || "-"}</div>
                  <div>Admission Semester: {enrollment?.admission_semester || "-"}</div>
                  <div>Enrollment Status: {enrollment?.enrollment_status || "-"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">Contact</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div>Phone: {student.phone || "-"}</div>
                  <div>Email: {student.email || "-"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">Advisor</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    {advisor
                      ? `${advisor.teacher_code} — ${advisor.full_name}`
                      : "-"}
                  </div>
                  <div>{advisor?.designation || "-"}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {Object.entries(modules).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-semibold capitalize">
                    {key.replace(/([A-Z])/g, " $1")}
                  </h3>
                  <p className="mt-3 rounded-full bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin-layout";

type StudentRow = {
  id: number;
  student_id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  current_status: string;
  enrollments: Array<{
    curriculum_key?: string | null;
    admission_semester?: string | null;
    program?: {
      short_name: string;
      name: string;
      departments?: {
        short_name: string;
      } | null;
    } | null;
    batches?: {
      batch_code: string;
    } | null;
  }>;
  advisor_assignments: Array<{
    teachers?: {
      teacher_code: string;
      full_name: string;
    } | null;
  }>;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  students?: StudentRow[];
};

export default function StudentsPageClient() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadStudents(targetPage = page) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("pageSize", "25");

      if (q.trim()) params.set("q", q.trim());
      if (status.trim()) params.set("status", status.trim());

      const res = await fetch(`/api/admin/students/list?${params.toString()}`, {
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load students.");
      }

      setStudents(json.students || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
      setPage(json.page || targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students.");
      setStudents([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents(1);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    loadStudents(1);
  }

  return (
    <AdminLayout title="Students">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Student Search and Detail Access
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                S1-C student profile, enrollment timeline, advisor, status, and portal preparation.
              </p>
            </div>

            <Link
              href="/student/dashboard"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Student Dashboard Preview
            </Link>
          </div>

          <form onSubmit={submitSearch} className="mt-5 grid gap-3 lg:grid-cols-4">
            <input
              placeholder="Search Student ID, name, phone, email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-xl border px-4 py-3 lg:col-span-2"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border px-4 py-3"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DROPPED">DROPPED</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="TRANSFERRED">TRANSFERRED</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Search"}
            </button>
          </form>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Student ID</th>
                <th className="border-b px-3 py-3 text-left">Name</th>
                <th className="border-b px-3 py-3 text-left">Program</th>
                <th className="border-b px-3 py-3 text-left">Batch</th>
                <th className="border-b px-3 py-3 text-left">Advisor</th>
                <th className="border-b px-3 py-3 text-left">Status</th>
                <th className="border-b px-3 py-3 text-left">Contact</th>
                <th className="border-b px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => {
                const enrollment = student.enrollments?.[0];
                const advisor = student.advisor_assignments?.[0]?.teachers;

                return (
                  <tr key={student.id}>
                    <td className="border-b px-3 py-2 font-medium">
                      {student.student_id}
                    </td>
                    <td className="border-b px-3 py-2">{student.full_name}</td>
                    <td className="border-b px-3 py-2">
                      {enrollment?.program?.short_name || "-"}
                    </td>
                    <td className="border-b px-3 py-2">
                      {enrollment?.batches?.batch_code || "-"}
                    </td>
                    <td className="border-b px-3 py-2">
                      {advisor
                        ? `${advisor.teacher_code} — ${advisor.full_name}`
                        : "-"}
                    </td>
                    <td className="border-b px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                        {student.current_status}
                      </span>
                    </td>
                    <td className="border-b px-3 py-2">
                      <div>{student.phone || "-"}</div>
                      <div className="text-xs text-slate-500">
                        {student.email || "-"}
                      </div>
                    </td>
                    <td className="border-b px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/students/${student.id}`}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Detail
                        </Link>

                        <Link
                          href={`/student/dashboard?studentId=${encodeURIComponent(student.student_id)}`}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50"
                        >
                          Dashboard
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {students.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            Total Students: <span className="font-semibold">{total}</span> | Page{" "}
            <span className="font-semibold">{page}</span> of{" "}
            <span className="font-semibold">{totalPages}</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => loadStudents(page - 1)}
              className="rounded-xl border px-4 py-2 disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => loadStudents(page + 1)}
              className="rounded-xl border px-4 py-2 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

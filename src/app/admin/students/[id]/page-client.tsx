"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AdminLayout from "@/components/admin-layout";

type StudentProfile = {
  id: number;
  student_id: string;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  email?: string | null;
  phone?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  present_address?: string | null;
  permanent_address?: string | null;
  admission_year?: number | null;
  admission_term_name?: string | null;
  current_status: string;
  remarks?: string | null;
  created_at: string;
  enrollments: Array<{
    id: number;
    curriculum_key?: string | null;
    enrollment_status: string;
    program: {
      short_name: string;
      name: string;
    };
    batches?: {
      batch_code: string;
    } | null;
  }>;
  advisor_assignments: Array<{
    is_active: boolean;
    assigned_at: string;
    teachers: {
      teacher_code: string;
      full_name: string;
      designation?: string | null;
    };
  }>;
  status_history: Array<{
    id: number;
    old_status?: string | null;
    new_status: string;
    note?: string | null;
    changed_at: string;
  }>;
};

export default function StudentProfilePageClient() {
  const params = useParams();
  const id = String(params.id || "");

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStudent() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load student profile.");
      }

      setStudent(json.student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load student profile.");
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadStudent();
  }, [id]);

  const activeEnrollment = student?.enrollments?.[0];
  const activeAdvisor = student?.advisor_assignments?.find((x) => x.is_active);

  return (
    <AdminLayout title="Student Profile">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/students"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Students
          </Link>

          <Link
            href={`/student/dashboard?studentId=${encodeURIComponent(student?.student_id || "")}`}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Student Dashboard Preview
          </Link>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            Loading student profile...
          </div>
        )}

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
                    {activeEnrollment?.program?.short_name || "-"} · Batch{" "}
                    {activeEnrollment?.batches?.batch_code || "-"} ·{" "}
                    {activeEnrollment?.curriculum_key || "No curriculum key"}
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {student.current_status}
                </span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Academic Identity</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Program:</span>{" "}
                    {activeEnrollment?.program?.name || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Batch:</span>{" "}
                    {activeEnrollment?.batches?.batch_code || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Curriculum:</span>{" "}
                    {activeEnrollment?.curriculum_key || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Admission:</span>{" "}
                    {student.admission_term_name || "-"}{" "}
                    {student.admission_year || ""}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Contact</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Phone:</span>{" "}
                    {student.phone || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span>{" "}
                    {student.email || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Guardian:</span>{" "}
                    {student.guardian_name || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Guardian Phone:</span>{" "}
                    {student.guardian_phone || "-"}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Advisor</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Advisor:</span>{" "}
                    {activeAdvisor
                      ? `${activeAdvisor.teachers.teacher_code} — ${activeAdvisor.teachers.full_name}`
                      : "-"}
                  </div>
                  <div>
                    <span className="font-medium">Designation:</span>{" "}
                    {activeAdvisor?.teachers?.designation || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Addresses</h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-2 text-sm">
                <div>
                  <p className="font-medium">Present Address</p>
                  <p className="mt-1 text-slate-600">
                    {student.present_address || "-"}
                  </p>
                </div>

                <div>
                  <p className="font-medium">Permanent Address</p>
                  <p className="mt-1 text-slate-600">
                    {student.permanent_address || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">Status History</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-3 text-left">Date</th>
                      <th className="border-b px-3 py-3 text-left">Old</th>
                      <th className="border-b px-3 py-3 text-left">New</th>
                      <th className="border-b px-3 py-3 text-left">Note</th>
                    </tr>
                  </thead>

                  <tbody>
                    {student.status_history.map((row) => (
                      <tr key={row.id}>
                        <td className="border-b px-3 py-2">
                          {new Date(row.changed_at).toLocaleString()}
                        </td>
                        <td className="border-b px-3 py-2">
                          {row.old_status || "-"}
                        </td>
                        <td className="border-b px-3 py-2">
                          {row.new_status}
                        </td>
                        <td className="border-b px-3 py-2">
                          {row.note || "-"}
                        </td>
                      </tr>
                    ))}

                    {student.status_history.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No status history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
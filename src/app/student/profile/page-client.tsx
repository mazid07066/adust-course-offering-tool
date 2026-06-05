"use client";

import { useEffect, useState } from "react";
import StudentLayout from "@/components/student-layout";

type ProfileResponse = {
  success?: boolean;
  error?: string;
  account?: any;
  student?: any;
  enrollments?: any[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "-";
  }
}

export default function StudentProfilePageClient() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    setLoading(true);

    try {
      const res = await fetch("/api/student/profile", {
        cache: "no-store",
      });

      const json = await res.json();

      if (res.status === 401) {
        window.location.href = "/student/login";
        return;
      }

      setData(json);
    } catch {
      setData({ error: "Failed to load student profile." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <StudentLayout title="My Profile">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Loading profile...
        </div>
      </StudentLayout>
    );
  }

  if (data?.error || !data?.student) {
    return (
      <StudentLayout title="My Profile">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {data?.error || "Student profile could not be loaded."}
        </div>
      </StudentLayout>
    );
  }

  const student = data.student;
  const account = data.account;
  const enrollments = data.enrollments || [];

  return (
    <StudentLayout
      title="My Profile"
      subtitle="Student identity, contact, guardian and enrollment timeline"
    >
      <div className="space-y-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Basic Information">
            <Field label="Student ID" value={student.student_id} />
            <Field label="Full Name" value={student.full_name} />
            <Field label="Gender" value={student.gender} />
            <Field label="Date of Birth" value={formatDate(student.date_of_birth)} />
            <Field label="Blood Group" value={student.blood_group} />
          </Section>

          <Section title="Portal Account">
            <Field label="Login Email" value={account?.email} />
            <Field
              label="Account Status"
              value={account?.is_active ? "Active" : "Inactive"}
            />
            <Field
              label="Password Status"
              value={
                account?.must_change_password
                  ? "Temporary password — change required"
                  : "Password updated"
              }
            />
            <Field label="Last Login" value={formatDate(account?.last_login_at)} />
          </Section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Contact Information">
            <Field label="Email" value={student.email} />
            <Field label="Phone" value={student.phone} />
            <Field label="Present Address" value={student.present_address} />
            <Field label="Permanent Address" value={student.permanent_address} />
          </Section>

          <Section title="Guardian Information">
            <Field label="Guardian Name" value={student.guardian_name} />
            <Field label="Guardian Phone" value={student.guardian_phone} />
          </Section>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Enrollment Timeline
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Program</th>
                  <th className="border-b px-3 py-3 text-left">Batch</th>
                  <th className="border-b px-3 py-3 text-left">
                    Admission Semester
                  </th>
                  <th className="border-b px-3 py-3 text-left">Status</th>
                  <th className="border-b px-3 py-3 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b px-3 py-2">
                      {row.program?.short_name || "-"}{" "}
                      <span className="text-slate-500">
                        {row.program?.name ? `— ${row.program.name}` : ""}
                      </span>
                    </td>
                    <td className="border-b px-3 py-2">
                      {row.batch?.batch_code || "-"}
                    </td>
                    <td className="border-b px-3 py-2">
                      {row.admission_semester || "-"}
                    </td>
                    <td className="border-b px-3 py-2">{row.status || "-"}</td>
                    <td className="border-b px-3 py-2">
                      {formatDate(row.updated_at || row.created_at)}
                    </td>
                  </tr>
                ))}

                {enrollments.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No enrollment timeline found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          Student profile editing is currently controlled by admin/coordinator.
          Self-service update requests can be added in a later checkpoint.
        </div>
      </div>
    </StudentLayout>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="grid gap-1 border-b border-slate-100 pb-3 last:border-b-0 sm:grid-cols-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="sm:col-span-2 text-sm font-medium text-slate-900">
        {value || "-"}
      </div>
    </div>
  );
}
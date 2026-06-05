"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StudentLayout from "@/components/student-layout";

type ProfileResponse = {
  success?: boolean;
  error?: string;
  account?: any;
  student?: any;
  enrollments?: any[];
};

export default function StudentDashboardPageClient() {
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
      setData({ error: "Failed to load dashboard." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <StudentLayout title="Dashboard">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Loading student dashboard...
        </div>
      </StudentLayout>
    );
  }

  if (data?.error || !data?.student) {
    return (
      <StudentLayout title="Dashboard">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {data?.error || "Student profile could not be loaded."}
        </div>
      </StudentLayout>
    );
  }

  const student = data.student;
  const account = data.account;
  const activeEnrollment = data.enrollments?.[0];

  return (
    <StudentLayout
      title="Dashboard"
      subtitle="Student account overview and academic identity"
    >
      <div className="space-y-6">
        {account?.must_change_password && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
            <h2 className="text-lg font-semibold">Password change required</h2>
            <p className="mt-1 text-sm">
              Your account is using a temporary password. Please change your
              password before continuing to use the student portal.
            </p>
            <Link
              href="/student/change-password"
              className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Change Password
            </Link>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-semibold text-slate-900">
              Welcome, {student.full_name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Student ID: {student.student_id}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoCard label="Portal Email" value={account?.email || "-"} />
              <InfoCard
                label="Portal Status"
                value={account?.is_active ? "Active" : "Inactive"}
              />
              <InfoCard
                label="Current Program"
                value={activeEnrollment?.program?.short_name || "-"}
              />
              <InfoCard
                label="Current Batch"
                value={activeEnrollment?.batch?.batch_code || "-"}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Quick Actions
            </h2>

            <div className="mt-4 space-y-3">
              <Link
                href="/student/profile"
                className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50"
              >
                View Full Profile
              </Link>

              <Link
                href="/student/change-password"
                className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50"
              >
                Change Password
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <LockedFeature title="Course Registration" />
          <LockedFeature title="Billing and Pay Slip" />
          <LockedFeature title="Attendance, Result and Admit Card" />
        </div>
      </div>
    </StudentLayout>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function LockedFeature({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm text-slate-500">
        This module is reserved for a later ERP checkpoint and is intentionally
        inactive in S1-E.
      </p>
    </div>
  );
}
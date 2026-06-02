"use client";

import type { StudentPortalSession } from "@/lib/student-session";

type Props = {
  session: StudentPortalSession;
};

export default function StudentDashboardClient({ session }: Props) {
  async function handleLogout() {
    await fetch("/api/student-auth/logout", {
      method: "POST",
    });

    window.location.href = "/student/login";
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
              UniFlow Student Portal
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Student Dashboard
            </h1>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Welcome, {session.fullName}
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Student ID
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {session.studentId}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Email
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {session.email || "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Portal Status
              </p>
              <p className="mt-2 text-lg font-semibold text-green-700">
                Active
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Academic Profile"
            description="Student profile and enrollment details will be displayed here."
            status="Foundation Active"
          />

          <FeatureCard
            title="Class Routine"
            description="Student-specific routine will be connected after official registration phase."
            status="Coming Later"
          />

          <FeatureCard
            title="Course Registration"
            description="Add/drop and seat-based registration will begin in S2, not S1-D."
            status="Inactive"
          />

          <FeatureCard
            title="Billing"
            description="Pay slip, fee structure, and defaulter status are reserved for billing phase."
            status="Inactive"
          />

          <FeatureCard
            title="Attendance"
            description="Attendance view will be added after attendance module implementation."
            status="Inactive"
          />

          <FeatureCard
            title="Results"
            description="Grade and result publication will be added in later ERP checkpoints."
            status="Inactive"
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {status}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
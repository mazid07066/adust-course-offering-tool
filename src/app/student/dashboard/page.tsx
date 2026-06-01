import { Suspense } from "react";
import StudentDashboardClient from "./page-client";

function StudentDashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
            UniFlow Student Portal
          </p>
          <h1 className="mt-3 text-3xl font-bold">Student Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Loading student dashboard...
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />
          <div className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />
          <div className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      </div>
    </main>
  );
}

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={<StudentDashboardLoading />}>
      <StudentDashboardClient />
    </Suspense>
  );
}
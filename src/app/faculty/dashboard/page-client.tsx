"use client";

import { useEffect, useState } from "react";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type DashboardResponse = {
  success?: boolean;
  error?: string;
  teacher?: {
    id: number;
    teacherCode: string;
    fullName: string;
    designation: string | null;
    departmentCode: string | null;
    departmentName: string | null;
    seniorityLevel: number | null;
  };
  policy?: {
    windowStatus: string;
    canActNow: boolean;
    creditPolicy: {
      level: number;
      minCredits: number | null;
      maxCredits: number | null;
    } | null;
  };
  activeTurn?: {
    teacherId: number;
    userId: number;
    teacherCode: string;
    fullName: string;
    seniorityLevel: number | null;
    sessionExpiresAt: string;
  } | null;
  queue?: Array<{
    rank: number;
    teacherId: number;
    userId: number;
    teacherCode: string;
    fullName: string;
    seniorityLevel: number | null;
    sessionExpiresAt: string;
  }>;
  session?: {
    expiresAt: string;
    remainingMinutes: number;
  };
  notifications?: {
    unreadCount: number;
    recent: Array<{
      id: number;
      event_type: string;
      title: string;
      message: string;
      is_read: boolean;
      created_at: string;
    }>;
  };
  visibleOfferingPool?: {
    activeTermName: string | null;
    visibleOfferingCount: number;
  };
};

function badgeClasses(status: string) {
  if (status === "OPEN") return "bg-green-100 text-green-700";
  if (status === "CLOSED") return "bg-red-100 text-red-700";
  if (status === "FINAL_LOCKED") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
}

export default function FacultyDashboardPageClient() {
  const { terms, termName, setTermName, loadingTerms } = useAcademicTerms();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);

  async function loadDashboard(selectedTerm?: string) {
    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams();
      if (selectedTerm || termName) {
        qs.set("termName", selectedTerm || termName);
      }

      const res = await fetch(`/api/faculty/dashboard?${qs.toString()}`, {
        cache: "no-store",
      });

      const json: DashboardResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load faculty dashboard.");
      }

      setDashboard(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty dashboard.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (termName) {
      loadDashboard();
    }
  }, [termName]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (termName) {
        loadDashboard();
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [termName]);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Faculty Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">
                All logged-in faculty may view the open pool. The most senior valid simultaneous session gets the active turn.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/faculty/course-choice"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Open Course Choice
              </a>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                  } finally {
                    window.location.href = "/auth/login";
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="max-w-md">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Academic Term
            </label>
            <select
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
              disabled={loadingTerms}
            >
              <option value="">
                {loadingTerms ? "Loading terms..." : "Select Academic Term"}
              </option>
              {terms.map((term) => (
                <option key={term.name} value={term.name}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {dashboard ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Faculty</div>
                <div className="mt-2 font-semibold text-slate-900">
                  {dashboard.teacher?.teacherCode} — {dashboard.teacher?.fullName}
                </div>
                <div className="text-sm text-slate-600">
                  {dashboard.teacher?.designation || "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Department / Level</div>
                <div className="mt-2 font-semibold text-slate-900">
                  {dashboard.teacher?.departmentCode || "-"} | Level {dashboard.teacher?.seniorityLevel ?? "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Choice Window</div>
                <div className="mt-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(
                      dashboard.policy?.windowStatus || ""
                    )}`}
                  >
                    {dashboard.policy?.windowStatus || "-"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Session Remaining</div>
                <div className="mt-2 font-semibold text-slate-900">
                  {dashboard.session?.remainingMinutes ?? 0} minute(s)
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Your Turn Status</div>
                <div className="mt-2 font-semibold text-slate-900">
                  {dashboard.policy?.canActNow ? "Active editor" : "View only"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Credit Rule</div>
                <div className="mt-2 font-semibold text-slate-900">
                  Min {dashboard.policy?.creditPolicy?.minCredits ?? "-"} | Max {dashboard.policy?.creditPolicy?.maxCredits ?? "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Visible Offering Pool</div>
                <div className="mt-2 font-semibold text-slate-900">
                  {dashboard.visibleOfferingPool?.visibleOfferingCount ?? 0} section(s)
                </div>
                <div className="text-sm text-slate-600">
                  Term: {dashboard.visibleOfferingPool?.activeTermName || "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Unread Notifications</div>
                <div className="mt-2 font-semibold text-slate-900">
                  {dashboard.notifications?.unreadCount ?? 0}
                </div>
              </div>
            </div>

            {dashboard.activeTurn ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Current Active Turn</h2>
                <div className="mt-3 text-sm text-slate-700">
                  <div>
                    {dashboard.activeTurn.teacherCode} — {dashboard.activeTurn.fullName}
                  </div>
                  <div>Seniority Level: {dashboard.activeTurn.seniorityLevel ?? "-"}</div>
                  <div>
                    Session expires at: {new Date(dashboard.activeTurn.sessionExpiresAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No active faculty turn is available right now.
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Logged-in Queue Order</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-3 text-left">Rank</th>
                      <th className="border-b px-3 py-3 text-left">Faculty</th>
                      <th className="border-b px-3 py-3 text-left">Seniority</th>
                      <th className="border-b px-3 py-3 text-left">Session Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard.queue || []).map((item) => (
                      <tr key={`${item.teacherId}-${item.rank}`}>
                        <td className="border-b px-3 py-2">{item.rank}</td>
                        <td className="border-b px-3 py-2">
                          {item.teacherCode} — {item.fullName}
                        </td>
                        <td className="border-b px-3 py-2">
                          {item.seniorityLevel ?? "-"}
                        </td>
                        <td className="border-b px-3 py-2">
                          {new Date(item.sessionExpiresAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}

                    {(dashboard.queue || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No active logged-in faculty queue found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Recent Notifications</h2>
                <div className="text-sm text-slate-500">
                  Unread: {dashboard.notifications?.unreadCount ?? 0}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {(dashboard.notifications?.recent || []).map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 ${
                      item.is_read
                        ? "border-slate-200 bg-white"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-700">{item.message}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                      </div>

                      {!item.is_read ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/faculty/notifications/${item.id}/read`, {
                              method: "POST",
                            });
                            loadDashboard();
                          }}
                          className="rounded-lg border px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          Mark Read
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}

                {(dashboard.notifications?.recent || []).length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                    No notifications found.
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : !loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
            Select a term to load the faculty dashboard.
          </div>
        ) : null}
      </div>
    </main>
  );
}
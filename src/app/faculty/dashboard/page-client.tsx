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

type SheetResponse = {
  success?: boolean;
  error?: string;
  faculty?: {
    teacherId: number;
    departmentName: string;
    departmentCode: string;
    fullName: string;
    designation: string;
    initial: string;
  };
  termName?: string;
  submittedAt?: string | null;
  assignedAt?: string | null;
  totals?: {
    theoryCredits: number;
    labCredits: number;
    totalCredits: number;
  };
  programTallies?: Array<{
    programCode: string;
    theoryCredits: number;
    labCredits: number;
    totalCredits: number;
  }>;
  scheduleRows?: Array<{
    courseCode: string;
    courseTitle: string;
    section: string;
    credit: number;
    category: "THEORY" | "LAB" | "PROJECT";
    dayOfWeek: string;
    timeText: string;
    roomText: string;
    batchCodes: string[];
  }>;
};

function badgeClasses(status: string) {
  if (status === "OPEN") return "bg-green-100 text-green-700";
  if (status === "CLOSED") return "bg-red-100 text-red-700";
  if (status === "FINAL_LOCKED") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
}

function renderSheetCard(
  title: string,
  subtitle: string,
  exportLabel: string,
  exportHref: string,
  sheet: SheetResponse | null
) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>

        <a
          href={exportHref}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {exportLabel}
        </a>
      </div>

      {sheet?.success && sheet.faculty ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Faculty's Department</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sheet.faculty.departmentCode} | {sheet.faculty.departmentName}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Semester for given choices</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sheet.termName || "-"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Date and time</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sheet.assignedAt
                  ? new Date(sheet.assignedAt).toLocaleString()
                  : sheet.submittedAt
                  ? new Date(sheet.submittedAt).toLocaleString()
                  : "-"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Faculty's Full Name</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sheet.faculty.fullName}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Faculty's Designation</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sheet.faculty.designation}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Faculty's Initial</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sheet.faculty.initial}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Total theory credits taken</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sheet.totals?.theoryCredits ?? 0}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Total lab credits taken</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sheet.totals?.labCredits ?? 0}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Total credits</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sheet.totals?.totalCredits ?? 0}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Total credits from which programs
            </h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-3 py-3 text-left">Program</th>
                    <th className="border-b px-3 py-3 text-left">Theory Credits</th>
                    <th className="border-b px-3 py-3 text-left">Lab Credits</th>
                    <th className="border-b px-3 py-3 text-left">Total Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {(sheet.programTallies || []).map((item) => (
                    <tr key={item.programCode}>
                      <td className="border-b px-3 py-2">{item.programCode}</td>
                      <td className="border-b px-3 py-2">{item.theoryCredits}</td>
                      <td className="border-b px-3 py-2">{item.labCredits}</td>
                      <td className="border-b px-3 py-2">{item.totalCredits}</td>
                    </tr>
                  ))}

                  {(sheet.programTallies || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        No program tally found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Full schedule of the courses
            </h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-3 py-3 text-left">Course Code</th>
                    <th className="border-b px-3 py-3 text-left">Section</th>
                    <th className="border-b px-3 py-3 text-left">Credit</th>
                    <th className="border-b px-3 py-3 text-left">Day</th>
                    <th className="border-b px-3 py-3 text-left">Time</th>
                    <th className="border-b px-3 py-3 text-left">Room</th>
                    <th className="border-b px-3 py-3 text-left">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {(sheet.scheduleRows || []).map((item, index) => (
                    <tr key={`${item.courseCode}-${item.section}-${index}`}>
                      <td className="border-b px-3 py-2">{item.courseCode}</td>
                      <td className="border-b px-3 py-2">{item.section}</td>
                      <td className="border-b px-3 py-2">{item.credit}</td>
                      <td className="border-b px-3 py-2">{item.dayOfWeek}</td>
                      <td className="border-b px-3 py-2">{item.timeText}</td>
                      <td className="border-b px-3 py-2">{item.roomText}</td>
                      <td className="border-b px-3 py-2">{item.category}</td>
                    </tr>
                  ))}

                  {(sheet.scheduleRows || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No rows found for this term.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-8">
            <div className="w-80 border-t border-slate-400 pt-2 text-sm text-slate-700">
              {sheet.faculty.fullName}
            </div>
            <div className="text-sm text-slate-500">Faculty Signature</div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
          No sheet data found for the selected term.
        </div>
      )}
    </div>
  );
}

export default function FacultyDashboardPageClient() {
  const { terms, termName, setTermName, loadingTerms } = useAcademicTerms();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [approvedSheet, setApprovedSheet] = useState<SheetResponse | null>(null);
  const [choiceSheet, setChoiceSheet] = useState<SheetResponse | null>(null);

  async function loadDashboard(selectedTerm?: string) {
    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams();
      if (selectedTerm || termName) {
        qs.set("termName", selectedTerm || termName);
      }

      const [dashboardRes, approvedRes, choiceRes] = await Promise.all([
        fetch(`/api/faculty/dashboard?${qs.toString()}`, {
          cache: "no-store",
        }),
        fetch(`/api/faculty/my-approved-assignment?${qs.toString()}`, {
          cache: "no-store",
        }),
        fetch(`/api/faculty/my-load-sheet?${qs.toString()}`, {
          cache: "no-store",
        }),
      ]);

      const dashboardJson: DashboardResponse = await dashboardRes.json();
      const approvedJson: SheetResponse = await approvedRes.json();
      const choiceJson: SheetResponse = await choiceRes.json();

      if (!dashboardRes.ok) {
        throw new Error(dashboardJson.error || "Failed to load faculty dashboard.");
      }

      setDashboard(dashboardJson);
      setApprovedSheet(approvedRes.ok ? approvedJson : null);
      setChoiceSheet(choiceRes.ok ? choiceJson : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty dashboard.");
      setDashboard(null);
      setApprovedSheet(null);
      setChoiceSheet(null);
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

  const hasApprovedAssignedRows =
    Boolean(approvedSheet?.success) &&
    Boolean(approvedSheet?.scheduleRows) &&
    (approvedSheet?.scheduleRows?.length || 0) > 0;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Faculty Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">
                View active policy, your notifications, your approved assigned schedule, and your finalized chosen list.
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

            {renderSheetCard(
              "Approved Assigned Schedule",
              "This is the authoritative schedule assigned by coordinator/admin.",
              "Export Approved Schedule Excel",
              `/api/faculty/my-approved-assignment/export?termName=${encodeURIComponent(termName)}`,
              approvedSheet
            )}

            {!hasApprovedAssignedRows
              ? renderSheetCard(
                  "Your Finalized Chosen Course List",
                  "No approved assignment is available yet, so your finalized chosen list is shown as reference.",
                  "Export Finalized Choice Excel",
                  `/api/faculty/my-load-sheet/export?termName=${encodeURIComponent(termName)}`,
                  choiceSheet
                )
              : null}
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
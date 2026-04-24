"use client";

import { useEffect, useMemo, useState } from "react";

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

function numberText(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : String(value);
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
            <InfoBox label="Faculty Department" value={`${sheet.faculty.departmentCode} | ${sheet.faculty.departmentName}`} />
            <InfoBox label="Semester" value={sheet.termName || "-"} />
            <InfoBox
              label="Date and Time"
              value={
                sheet.assignedAt
                  ? new Date(sheet.assignedAt).toLocaleString()
                  : sheet.submittedAt
                  ? new Date(sheet.submittedAt).toLocaleString()
                  : "-"
              }
            />
            <InfoBox label="Faculty Full Name" value={sheet.faculty.fullName} />
            <InfoBox label="Designation" value={sheet.faculty.designation} />
            <InfoBox label="Faculty Initial" value={sheet.faculty.initial} />
            <InfoBox label="Theory Credits" value={String(sheet.totals?.theoryCredits ?? 0)} />
            <InfoBox label="Lab Credits" value={String(sheet.totals?.labCredits ?? 0)} />
            <InfoBox label="Total Credits" value={String(sheet.totals?.totalCredits ?? 0)} />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Program-wise Credit Distribution
            </h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-3 py-3 text-left">Program</th>
                    <th className="border-b px-3 py-3 text-left">Theory</th>
                    <th className="border-b px-3 py-3 text-left">Lab</th>
                    <th className="border-b px-3 py-3 text-left">Total</th>
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
                  {(sheet.programTallies || []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        No program tally found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Full Course Schedule
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
                  {(sheet.scheduleRows || []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No rows found for this term.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
          No sheet data found for this semester.
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function FacultyDashboardPageClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [approvedSheet, setApprovedSheet] = useState<SheetResponse | null>(null);
  const [choiceSheet, setChoiceSheet] = useState<SheetResponse | null>(null);

  const activeTermName = dashboard?.visibleOfferingPool?.activeTermName || "";

  const preassignedCredits = approvedSheet?.success
    ? Number(approvedSheet.totals?.totalCredits || 0)
    : 0;

  const facultyChoiceCredits = choiceSheet?.success
    ? Number(choiceSheet.totals?.totalCredits || 0)
    : 0;

  const maxCredits = dashboard?.policy?.creditPolicy?.maxCredits ?? null;

  const remainingChoiceCapacity =
    maxCredits === null || maxCredits === undefined
      ? null
      : Number(Math.max(0, maxCredits - preassignedCredits).toFixed(2));

  const hasApprovedAssignedRows =
    Boolean(approvedSheet?.success) &&
    Boolean(approvedSheet?.scheduleRows) &&
    (approvedSheet?.scheduleRows?.length || 0) > 0;

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const dashboardRes = await fetch("/api/faculty/dashboard", {
        cache: "no-store",
      });

      const dashboardJson: DashboardResponse = await dashboardRes.json();

      if (!dashboardRes.ok) {
        throw new Error(dashboardJson.error || "Failed to load faculty dashboard.");
      }

      setDashboard(dashboardJson);

      const term = dashboardJson.visibleOfferingPool?.activeTermName || "";

      if (term) {
        const qs = new URLSearchParams();
        qs.set("termName", term);

        const [approvedRes, choiceRes] = await Promise.all([
          fetch(`/api/faculty/my-approved-assignment?${qs.toString()}`, {
            cache: "no-store",
          }),
          fetch(`/api/faculty/my-load-sheet?${qs.toString()}`, {
            cache: "no-store",
          }),
        ]);

        const approvedJson: SheetResponse = await approvedRes.json();
        const choiceJson: SheetResponse = await choiceRes.json();

        setApprovedSheet(approvedRes.ok ? approvedJson : null);
        setChoiceSheet(choiceRes.ok ? choiceJson : null);
      } else {
        setApprovedSheet(null);
        setChoiceSheet(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty dashboard.");
      setDashboard(null);
      setApprovedSheet(null);
      setChoiceSheet(null);
    } finally {
      setLoading(false);
    }
  }

  async function clearAllNotifications() {
    await fetch("/api/faculty/notifications/clear", { method: "POST" });
    await loadDashboard();
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const timer = setInterval(loadDashboard, 60000);
    return () => clearInterval(timer);
  }, []);

  const notifications = dashboard?.notifications?.recent || [];
  const unreadCount = dashboard?.notifications?.unreadCount || 0;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Faculty Dashboard</h1>
            <p className="text-sm text-slate-600">
              Current Semester:{" "}
              <span className="font-semibold text-slate-900">
                {activeTermName || "Not opened by coordinator/admin yet"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
              Notifications: {unreadCount}
            </div>

            <button
              type="button"
              onClick={clearAllNotifications}
              disabled={unreadCount === 0}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Clear Notifications
            </button>

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

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {dashboard ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoBox
                label="Faculty"
                value={`${dashboard.teacher?.teacherCode || "-"} - ${
                  dashboard.teacher?.fullName || "-"
                }`}
              />

              <InfoBox
                label="Department"
                value={`${dashboard.teacher?.departmentCode || "-"} | ${
                  dashboard.teacher?.departmentName || "-"
                }`}
              />

              <InfoBox
                label="Seniority Position"
                value={
                  dashboard.teacher?.seniorityLevel
                    ? `Seniority ${dashboard.teacher.seniorityLevel} (lower number = higher priority)`
                    : "-"
                }
              />

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

              <InfoBox
                label="Your Turn Status"
                value={dashboard.policy?.canActNow ? "Active editor" : "View only"}
              />

              <InfoBox
                label="Current Active Faculty"
                value={
                  dashboard.activeTurn
                    ? `${dashboard.activeTurn.teacherCode} - ${dashboard.activeTurn.fullName}`
                    : "-"
                }
              />

              <InfoBox
                label="Session Remaining"
                value={`${dashboard.session?.remainingMinutes ?? 0} minute(s)`}
              />

              <InfoBox
                label="Visible Offering Pool"
                value={`${dashboard.visibleOfferingPool?.visibleOfferingCount ?? 0} section(s)`}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoBox
                label="Credit Rule"
                value={`Min ${numberText(
                  dashboard.policy?.creditPolicy?.minCredits
                )} | Max ${numberText(dashboard.policy?.creditPolicy?.maxCredits)}`}
              />

              <InfoBox
                label="Coordinator Pre-assigned Credits"
                value={String(preassignedCredits)}
              />

              <InfoBox
                label="Faculty Choice Credits"
                value={String(facultyChoiceCredits)}
              />

              <InfoBox
                label="Remaining Choice Capacity"
                value={remainingChoiceCapacity === null ? "-" : String(remainingChoiceCapacity)}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Recent Notifications
                  </h2>
                  <p className="text-sm text-slate-600">
                    Showing latest notifications. Use the top button to clear all unread notifications.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearAllNotifications}
                  disabled={unreadCount === 0}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Clear All Unread
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 ${
                      item.is_read
                        ? "border-slate-200 bg-white"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-700">{item.message}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                    No notifications found.
                  </div>
                )}
              </div>
            </div>

            {activeTermName &&
              renderSheetCard(
                "Approved Assigned Schedule",
                "This is the authoritative schedule assigned by coordinator/admin.",
                "Export Approved Schedule Excel",
                `/api/faculty/my-approved-assignment/export?termName=${encodeURIComponent(
                  activeTermName
                )}`,
                approvedSheet
              )}

            {activeTermName && !hasApprovedAssignedRows
              ? renderSheetCard(
                  "Your Finalized Chosen Course List",
                  "No approved assignment is available yet, so your finalized chosen list is shown as reference.",
                  "Export Finalized Choice Excel",
                  `/api/faculty/my-load-sheet/export?termName=${encodeURIComponent(
                    activeTermName
                  )}`,
                  choiceSheet
                )
              : null}
          </>
        ) : !loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
            No faculty-visible semester is currently opened by coordinator/admin.
          </div>
        ) : null}
      </div>
    </main>
  );
}
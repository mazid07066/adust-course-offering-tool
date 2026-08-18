"use client";

import { useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: number;
  event_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

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
    recent: NotificationItem[];
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
  if (status === "OPEN") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "CLOSED") {
    return "bg-red-100 text-red-700";
  }

  if (status === "FINAL_LOCKED") {
    return "bg-purple-100 text-purple-700";
  }

  return "bg-slate-100 text-slate-700";
}

function numberText(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : String(value);
}

function timeAgo(value: string) {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const seconds = Math.max(0, Math.floor(difference / 1000));

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 21h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M20 11a8 8 0 10-2.34 5.66"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 5v6h-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoBox({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        emphasis
          ? "border-blue-200 bg-blue-50 shadow-sm"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div
        className={`text-sm ${
          emphasis ? "text-blue-700" : "text-slate-500"
        }`}
      >
        {label}
      </div>

      <div
        className={`mt-1 font-semibold ${
          emphasis ? "text-blue-950" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function renderSheetCard(
  title: string,
  subtitle: string,
  exportLabel: string,
  exportHref: string,
  sheet: SheetResponse | null
) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>

          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <a
          href={exportHref}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          {exportLabel}
        </a>
      </div>

      {sheet?.success && sheet.faculty ? (
        <div className="space-y-7 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <InfoBox
              label="Faculty Department"
              value={`${sheet.faculty.departmentCode} | ${sheet.faculty.departmentName}`}
            />

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

            <InfoBox
              label="Faculty Full Name"
              value={sheet.faculty.fullName}
            />

            <InfoBox
              label="Designation"
              value={sheet.faculty.designation}
            />

            <InfoBox
              label="Faculty Initial"
              value={sheet.faculty.initial}
            />

            <InfoBox
              label="Theory Credits"
              value={String(sheet.totals?.theoryCredits ?? 0)}
            />

            <InfoBox
              label="Lab Credits"
              value={String(sheet.totals?.labCredits ?? 0)}
            />

            <InfoBox
              label="Total Credits"
              value={String(sheet.totals?.totalCredits ?? 0)}
              emphasis
            />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Program-wise Credit Distribution
            </h3>

            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Program
                    </th>

                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Theory
                    </th>

                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Lab
                    </th>

                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(sheet.programTallies || []).map((item) => (
                    <tr
                      key={item.programCode}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">
                        {item.programCode}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
                        {item.theoryCredits}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
                        {item.labCredits}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3 font-semibold">
                        {item.totalCredits}
                      </td>
                    </tr>
                  ))}

                  {(sheet.programTallies || []).length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-7 text-center text-slate-500"
                      >
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
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Course Code
                    </th>

                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Section
                    </th>

                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Credit
                    </th>

                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Day
                    </th>

                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Time
                    </th>

                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Room
                    </th>

                    <th className="border-b px-4 py-3 text-left font-semibold">
                      Category
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(sheet.scheduleRows || []).map((item, index) => (
                    <tr
                      key={`${item.courseCode}-${item.section}-${index}`}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
                        {item.courseCode}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
                        {item.section}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
                        {item.credit}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
                        {item.dayOfWeek}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
                        {item.timeText}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
                        {item.roomText}
                      </td>

                      <td className="border-b border-slate-100 px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {item.category}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {(sheet.scheduleRows || []).length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-7 text-center text-slate-500"
                      >
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
        <div className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          No sheet data found for this semester.
        </div>
      )}
    </section>
  );
}

export default function FacultyDashboardPageClient() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [dashboard, setDashboard] =
    useState<DashboardResponse | null>(null);

  const [approvedSheet, setApprovedSheet] =
    useState<SheetResponse | null>(null);

  const [choiceSheet, setChoiceSheet] =
    useState<SheetResponse | null>(null);

  const [notificationOpen, setNotificationOpen] = useState(false);

  const notificationPanelRef = useRef<HTMLDivElement | null>(null);

  const activeTermName =
    dashboard?.visibleOfferingPool?.activeTermName || "";

  const preassignedCredits = approvedSheet?.success
    ? Number(approvedSheet.totals?.totalCredits || 0)
    : 0;

  const facultyChoiceCredits = choiceSheet?.success
    ? Number(choiceSheet.totals?.totalCredits || 0)
    : 0;

  const maxCredits =
    dashboard?.policy?.creditPolicy?.maxCredits ?? null;

  const remainingChoiceCapacity =
    maxCredits === null || maxCredits === undefined
      ? null
      : Number(
          Math.max(0, maxCredits - preassignedCredits).toFixed(2)
        );

  const hasApprovedAssignedRows =
    Boolean(approvedSheet?.success) &&
    Boolean(approvedSheet?.scheduleRows) &&
    (approvedSheet?.scheduleRows?.length || 0) > 0;

  const notifications =
    dashboard?.notifications?.recent || [];

  const unreadCount =
    dashboard?.notifications?.unreadCount || 0;

  async function loadSheets(term: string) {
    const qs = new URLSearchParams();
    qs.set("termName", term);

    const [approvedRes, choiceRes] = await Promise.all([
      fetch(
        `/api/faculty/my-approved-assignment?${qs.toString()}`,
        {
          cache: "no-store",
        }
      ),

      fetch(`/api/faculty/my-load-sheet?${qs.toString()}`, {
        cache: "no-store",
      }),
    ]);

    const approvedJson: SheetResponse =
      await approvedRes.json();

    const choiceJson: SheetResponse =
      await choiceRes.json();

    setApprovedSheet(
      approvedRes.ok ? approvedJson : null
    );

    setChoiceSheet(
      choiceRes.ok ? choiceJson : null
    );
  }

  async function loadDashboard(options?: {
    loadSheets?: boolean;
    showLoading?: boolean;
  }) {
    const shouldLoadSheets =
      options?.loadSheets ?? false;

    const showLoading =
      options?.showLoading ?? false;

    if (showLoading) {
      setLoading(true);
    }

    setError("");

    try {
      const dashboardRes = await fetch(
        "/api/faculty/dashboard",
        {
          cache: "no-store",
        }
      );

      const dashboardJson: DashboardResponse =
        await dashboardRes.json();

      if (!dashboardRes.ok) {
        throw new Error(
          dashboardJson.error ||
            "Failed to load faculty dashboard."
        );
      }

      setDashboard(dashboardJson);

      const term =
        dashboardJson.visibleOfferingPool
          ?.activeTermName || "";

      if (shouldLoadSheets) {
        if (term) {
          await loadSheets(term);
        } else {
          setApprovedSheet(null);
          setChoiceSheet(null);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load faculty dashboard."
      );

      if (showLoading) {
        setDashboard(null);
        setApprovedSheet(null);
        setChoiceSheet(null);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function manualRefresh() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);

    try {
      await loadDashboard({
        loadSheets: true,
        showLoading: false,
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function markNotificationRead(
    notification: NotificationItem
  ) {
    if (notification.is_read) {
      return;
    }

    setDashboard((current) => {
      if (!current?.notifications) {
        return current;
      }

      return {
        ...current,
        notifications: {
          unreadCount: Math.max(
            0,
            current.notifications.unreadCount - 1
          ),

          recent: current.notifications.recent.map(
            (item) =>
              item.id === notification.id
                ? {
                    ...item,
                    is_read: true,
                  }
                : item
          ),
        },
      };
    });

    try {
      const response = await fetch(
        `/api/faculty/notifications/${notification.id}/read`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        await loadDashboard({
          loadSheets: false,
          showLoading: false,
        });
      }
    } catch {
      await loadDashboard({
        loadSheets: false,
        showLoading: false,
      });
    }
  }

  async function clearAllNotifications() {
    if (unreadCount === 0) {
      return;
    }

    setDashboard((current) => {
      if (!current?.notifications) {
        return current;
      }

      return {
        ...current,
        notifications: {
          unreadCount: 0,

          recent: current.notifications.recent.map(
            (item) => ({
              ...item,
              is_read: true,
            })
          ),
        },
      };
    });

    try {
      const response = await fetch(
        "/api/faculty/notifications/clear",
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        await loadDashboard({
          loadSheets: false,
          showLoading: false,
        });
      }
    } catch {
      await loadDashboard({
        loadSheets: false,
        showLoading: false,
      });
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/auth/login";
    }
  }

  useEffect(() => {
    loadDashboard({
      loadSheets: true,
      showLoading: true,
    });
  }, []);

  /*
   * Keep turn/session/notification information fresh,
   * but do not repeatedly reload the expensive schedule
   * sheets every minute.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      loadDashboard({
        loadSheets: false,
        showLoading: false,
      });
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  /*
   * Close the notification panel when the user clicks
   * anywhere outside it.
   */
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        notificationPanelRef.current &&
        !notificationPanelRef.current.contains(
          event.target as Node
        )
      ) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Faculty Dashboard
            </h1>

            <p className="mt-0.5 text-sm text-slate-500">
              Current Semester:{" "}
              <span className="font-semibold text-slate-800">
                {activeTermName ||
                  "Not opened by coordinator/admin yet"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={manualRefresh}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className={
                  refreshing ? "animate-spin" : ""
                }
              >
                <RefreshIcon />
              </span>

              <span className="hidden sm:inline">
                Refresh
              </span>
            </button>

            <div
              ref={notificationPanelRef}
              className="relative"
            >
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={notificationOpen}
                onClick={() =>
                  setNotificationOpen(
                    (current) => !current
                  )
                }
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                  notificationOpen
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <BellIcon />

                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                    {unreadCount > 99
                      ? "99+"
                      : unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <h2 className="font-semibold text-slate-950">
                        Notifications
                      </h2>

                      <p className="text-xs text-slate-500">
                        {unreadCount > 0
                          ? `${unreadCount} unread`
                          : "You're all caught up"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={clearAllNotifications}
                      disabled={unreadCount === 0}
                      className="text-xs font-semibold text-blue-700 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-[460px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map(
                        (notification) => (
                          <button
                            type="button"
                            key={notification.id}
                            onClick={() =>
                              markNotificationRead(
                                notification
                              )
                            }
                            className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                              notification.is_read
                                ? "bg-white hover:bg-slate-50"
                                : "bg-blue-50/80 hover:bg-blue-50"
                            }`}
                          >
                            <div
                              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                notification.is_read
                                  ? "bg-slate-300"
                                  : "bg-blue-600"
                              }`}
                            />

                            <div className="min-w-0 flex-1">
                              <div
                                className={`text-sm text-slate-950 ${
                                  notification.is_read
                                    ? "font-medium"
                                    : "font-semibold"
                                }`}
                              >
                                {notification.title}
                              </div>

                              <p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-600">
                                {notification.message}
                              </p>

                              <div className="mt-1.5 text-xs font-medium text-slate-400">
                                {timeAgo(
                                  notification.created_at
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      )
                    ) : (
                      <div className="px-5 py-10 text-center">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <BellIcon />
                        </div>

                        <p className="mt-3 text-sm font-medium text-slate-700">
                          No notifications
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          New faculty-choice updates will
                          appear here.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <a
              href="/faculty/course-choice"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Open Course Choice
            </a>

            <button
              type="button"
              onClick={logout}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {dashboard ? (
          <>
            {dashboard.policy?.canActNow && (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-emerald-950">
                    Your faculty choice turn is active
                  </div>

                  <div className="mt-0.5 text-sm text-emerald-700">
                    You can currently select and submit
                    courses.
                  </div>
                </div>

                <a
                  href="/faculty/course-choice"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  Choose Courses
                </a>
              </div>
            )}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Faculty & Session
                  </h2>
                </div>

                {loading && (
                  <div className="text-xs font-medium text-slate-400">
                    Loading…
                  </div>
                )}
              </div>

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
                      ? `Seniority ${dashboard.teacher.seniorityLevel}`
                      : "-"
                  }
                />

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm text-slate-500">
                    Choice Window
                  </div>

                  <div className="mt-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(
                        dashboard.policy
                          ?.windowStatus || ""
                      )}`}
                    >
                      {dashboard.policy
                        ?.windowStatus || "-"}
                    </span>
                  </div>
                </div>

                <InfoBox
                  label="Your Turn Status"
                  value={
                    dashboard.policy?.canActNow
                      ? "Active editor"
                      : "View only"
                  }
                  emphasis={
                    Boolean(
                      dashboard.policy?.canActNow
                    )
                  }
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
            </section>

            <section>
              <div className="mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Credit Load
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoBox
                  label="Credit Rule"
                  value={`Min ${numberText(
                    dashboard.policy?.creditPolicy
                      ?.minCredits
                  )} | Max ${numberText(
                    dashboard.policy?.creditPolicy
                      ?.maxCredits
                  )}`}
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
                  value={
                    remainingChoiceCapacity === null
                      ? "-"
                      : String(
                          remainingChoiceCapacity
                        )
                  }
                />
              </div>
            </section>

            {activeTermName &&
              renderSheetCard(
                "Approved Assigned Schedule",
                "Authoritative schedule assigned by coordinator/admin.",
                "Export Approved Schedule Excel",
                `/api/faculty/my-approved-assignment/export?termName=${encodeURIComponent(
                  activeTermName
                )}`,
                approvedSheet
              )}

            {activeTermName &&
            !hasApprovedAssignedRows
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
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-slate-500 shadow-sm">
            No faculty-visible semester is currently
            opened by coordinator/admin.
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-slate-500 shadow-sm">
            Loading faculty dashboard…
          </div>
        )}
      </div>
    </main>
  );
}
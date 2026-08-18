"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import FacultyTeachingPlanner from "./FacultyTeachingPlanner";
import UniFlowLogo from "@/components/uniflow-logo";

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

type ScheduleRow = {
  offeredCourseId?: number | null;
  courseCode: string;
  coOfferedCourseCodes?: string[];
  courseTitle: string;
  section: string;
  credit: number;
  category: "THEORY" | "LAB" | "PROJECT";
  dayOfWeek: string;
  timeText: string;
  roomText: string;
  batchCodes: string[];
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

  scheduleRows?: ScheduleRow[];
};

type CourseSummary = {
  key: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  credit: number;
  category: ScheduleRow["category"];
  batchCodes: string[];
  meetings: ScheduleRow[];
};

type ScheduleOccurrence = {
  row: ScheduleRow;
  start: Date;
  end: Date | null;
};

const FALL_2026_START = new Date(
  2026,
  8,
  1,
  0,
  0,
  0,
  0
);

const DAY_NUMBER: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function badgeClasses(status: string) {
  if (status === "OPEN") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "CLOSED") {
    return "bg-slate-100 text-slate-700";
  }

  if (status === "FINAL_LOCKED") {
    return "bg-purple-100 text-purple-700";
  }

  return "bg-slate-100 text-slate-700";
}

function numberText(
  value: number | null | undefined
) {
  return value === null || value === undefined
    ? "-"
    : String(value);
}

function combinedCourseCodes(
  primaryCode: string,
  coOfferedCourseCodes?: string[]
) {
  const codes = Array.from(
    new Set(
      [
        primaryCode,
        ...(coOfferedCourseCodes || []),
      ]
        .map((code) => String(code || "").trim())
        .filter(Boolean)
    )
  );

  return codes.join(" / ");
}

function normalizeDay(value: string) {
  const upper = String(value || "")
    .trim()
    .toUpperCase();

  if (DAY_NUMBER[upper] !== undefined) {
    return DAY_LABELS[DAY_NUMBER[upper]];
  }

  return "";
}

function parseClockPart(value: string) {
  const cleaned = value
    .trim()
    .replace(/\./g, "")
    .toUpperCase();

  const match = cleaned.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/
  );

  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3];

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  if (suffix) {
    if (hour > 12) {
      return null;
    }

    if (suffix === "AM" && hour === 12) {
      hour = 0;
    }

    if (suffix === "PM" && hour !== 12) {
      hour += 12;
    }
  }

  return {
    hour,
    minute,
  };
}

function parseTimeRange(value: string) {
  const normalized = String(value || "")
    .replace(/[–—]/g, "-")
    .trim();

  const parts = normalized
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 1) {
    return null;
  }

  const start = parseClockPart(parts[0]);

  if (!start) {
    return null;
  }

  const end =
    parts.length > 1
      ? parseClockPart(parts[1])
      : null;

  return {
    start,
    end,
  };
}

function startOfLocalDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0
  );
}

function differenceInCalendarDays(
  later: Date,
  earlier: Date
) {
  const a = startOfLocalDay(later).getTime();
  const b = startOfLocalDay(earlier).getTime();

  return Math.round(
    (a - b) / (24 * 60 * 60 * 1000)
  );
}

function getSemesterContext(now: Date) {
  const daysUntilStart =
    differenceInCalendarDays(
      FALL_2026_START,
      now
    );

  if (daysUntilStart > 1) {
    return {
      phase: "PRE_SEMESTER" as const,
      eyebrow: "Semester preparation",
      title: `Semester begins in ${daysUntilStart} days`,
      subtitle:
        "FALL 2026 begins on 1 September 2026.",
      daysUntilStart,
      weekNumber: null,
    };
  }

  if (daysUntilStart === 1) {
    return {
      phase: "PRE_SEMESTER" as const,
      eyebrow: "Semester preparation",
      title: "Semester begins tomorrow",
      subtitle:
        "FALL 2026 begins on 1 September 2026.",
      daysUntilStart,
      weekNumber: null,
    };
  }

  if (daysUntilStart === 0) {
    return {
      phase: "START_DAY" as const,
      eyebrow: "Semester opening day",
      title: "FALL 2026 starts today",
      subtitle:
        "The semester begins today, 1 September 2026.",
      daysUntilStart,
      weekNumber: 1,
    };
  }

  const elapsedDays =
    differenceInCalendarDays(
      now,
      FALL_2026_START
    );

  const weekNumber =
    Math.floor(elapsedDays / 7) + 1;

  return {
    phase: "IN_PROGRESS" as const,
    eyebrow: "Semester in progress",
    title: `Week ${weekNumber} of FALL 2026`,
    subtitle: `${elapsedDays + 1} day${
      elapsedDays === 0 ? "" : "s"
    } since semester start.`,
    daysUntilStart,
    weekNumber,
  };
}

function formatDisplayDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(value);
}

function formatClock(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function timeAgo(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const difference =
    Date.now() - date.getTime();

  const seconds = Math.max(
    0,
    Math.floor(difference / 1000)
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}

function countdownText(
  target: Date,
  now: Date
) {
  const difference =
    target.getTime() - now.getTime();

  if (difference <= 0) {
    return "Now";
  }

  const minutes = Math.floor(
    difference / 60000
  );

  if (minutes < 60) {
    return `${Math.max(
      1,
      minutes
    )} min`;
  }

  const hours = Math.floor(
    minutes / 60
  );

  const remainingMinutes =
    minutes % 60;

  if (hours < 24) {
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(
    hours / 24
  );

  return `${days} day${
    days === 1 ? "" : "s"
  }`;
}

function getOccurrenceForDate(
  row: ScheduleRow,
  date: Date
): ScheduleOccurrence | null {
  const day = normalizeDay(
    row.dayOfWeek
  );

  if (!day) {
    return null;
  }

  const range = parseTimeRange(
    row.timeText
  );

  if (!range) {
    return null;
  }

  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    range.start.hour,
    range.start.minute,
    0,
    0
  );

  const end = range.end
    ? new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        range.end.hour,
        range.end.minute,
        0,
        0
      )
    : null;

  return {
    row,
    start,
    end,
  };
}

function getNextOccurrence(
  rows: ScheduleRow[],
  now: Date,
  semesterStarted: boolean
) {
  if (rows.length === 0) {
    return null;
  }

  const searchStart = semesterStarted
    ? new Date(now)
    : new Date(FALL_2026_START);

  let best:
    | ScheduleOccurrence
    | null = null;

  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const date = new Date(
      searchStart.getFullYear(),
      searchStart.getMonth(),
      searchStart.getDate() +
        dayOffset,
      0,
      0,
      0,
      0
    );

    const dateDay = date.getDay();

    for (const row of rows) {
      const normalizedDay =
        normalizeDay(row.dayOfWeek);

      if (!normalizedDay) {
        continue;
      }

      const rowDay =
        DAY_NUMBER[
          normalizedDay.toUpperCase()
        ];

      if (rowDay !== dateDay) {
        continue;
      }

      const occurrence =
        getOccurrenceForDate(
          row,
          date
        );

      if (!occurrence) {
        continue;
      }

      const lowerBoundary =
        semesterStarted
          ? now
          : FALL_2026_START;

      if (
        occurrence.start.getTime() <
        lowerBoundary.getTime()
      ) {
        continue;
      }

      if (
        !best ||
        occurrence.start.getTime() <
          best.start.getTime()
      ) {
        best = occurrence;
      }
    }
  }

  return best;
}

function uniqueCourseKey(
  row: ScheduleRow
) {
  return `${combinedCourseCodes(row.courseCode, row.coOfferedCourseCodes)}::${row.section}`;
}

function categoryBadgeClasses(
  category: ScheduleRow["category"]
) {
  if (category === "LAB") {
    return "bg-violet-100 text-violet-700";
  }

  if (category === "PROJECT") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-blue-100 text-blue-700";
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

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M7 3v4M17 3v4M3 10h18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M4 5.5A2.5 2.5 0 016.5 3H11v16H6.5A2.5 2.5 0 004 21.5v-16z"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M20 5.5A2.5 2.5 0 0017.5 3H13v16h4.5a2.5 2.5 0 012.5 2.5v-16z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition ${
        emphasis
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className={`text-sm font-medium ${
              emphasis
                ? "text-blue-700"
                : "text-slate-500"
            }`}
          >
            {label}
          </div>

          <div
            className={`mt-2 text-2xl font-bold tracking-tight ${
              emphasis
                ? "text-blue-950"
                : "text-slate-950"
            }`}
          >
            {value}
          </div>

          {helper && (
            <div
              className={`mt-1 text-xs ${
                emphasis
                  ? "text-blue-700"
                  : "text-slate-500"
              }`}
            >
              {helper}
            </div>
          )}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            emphasis
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-24 rounded bg-slate-200" />
      <div className="mt-4 h-7 w-20 rounded bg-slate-200" />
      <div className="mt-3 h-3 w-32 rounded bg-slate-100" />
    </div>
  );
}

export default function FacultyDashboardPageClient() {
  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [dashboard, setDashboard] =
    useState<DashboardResponse | null>(
      null
    );

  const [approvedSheet, setApprovedSheet] =
    useState<SheetResponse | null>(
      null
    );

  const [choiceSheet, setChoiceSheet] =
    useState<SheetResponse | null>(
      null
    );

  const [
    notificationOpen,
    setNotificationOpen,
  ] = useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [selectedDay, setSelectedDay] =
    useState("");

  const [now, setNow] = useState(
    () => new Date()
  );

  const notificationPanelRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const profilePanelRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const activeTermName =
    dashboard?.visibleOfferingPool
      ?.activeTermName || "";

  const effectiveSheet =
    approvedSheet?.success
      ? approvedSheet
      : choiceSheet?.success
        ? choiceSheet
        : null;

  const scheduleRows = useMemo(
    () =>
      effectiveSheet?.scheduleRows ||
      [],
    [effectiveSheet]
  );

  const approvedRows =
    approvedSheet?.scheduleRows || [];

  const hasApprovedAssignedRows =
    Boolean(approvedSheet?.success) &&
    approvedRows.length > 0;

  const choiceIsOpen =
    dashboard?.policy?.windowStatus ===
    "OPEN";

  const semesterContext =
    useMemo(
      () => getSemesterContext(now),
      [now]
    );

  const semesterStarted =
    semesterContext.phase !==
      "PRE_SEMESTER";

  const assignmentReady =
    hasApprovedAssignedRows;

  const assignmentStatusText =
    assignmentReady
      ? "Faculty assignment finalized"
      : effectiveSheet?.success
        ? "Faculty load prepared"
        : "Assignment preparation in progress";

  const totalCredits =
    effectiveSheet?.totals?.totalCredits ??
    0;

  const theoryCredits =
    effectiveSheet?.totals?.theoryCredits ??
    0;

  const labCredits =
    effectiveSheet?.totals?.labCredits ??
    0;

  const maxCredits =
    dashboard?.policy?.creditPolicy
      ?.maxCredits ?? null;

  const minCredits =
    dashboard?.policy?.creditPolicy
      ?.minCredits ?? null;

  const courseSummaries =
    useMemo<CourseSummary[]>(() => {
      const map = new Map<
        string,
        CourseSummary
      >();

      for (const row of scheduleRows) {
        const key =
          uniqueCourseKey(row);

        const existing =
          map.get(key);

        if (existing) {
          existing.meetings.push(row);

          existing.batchCodes =
            Array.from(
              new Set([
                ...existing.batchCodes,
                ...(row.batchCodes || []),
              ])
            );

          continue;
        }

        map.set(key, {
          key,
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          section: row.section,
          credit: Number(
            row.credit || 0
          ),
          category: row.category,
          batchCodes:
            row.batchCodes || [],
          meetings: [row],
        });
      }

      return Array.from(
        map.values()
      ).sort((a, b) =>
        a.courseCode.localeCompare(
          b.courseCode
        )
      );
    }, [scheduleRows]);

  const teachingDays =
    useMemo(() => {
      const set = new Set<string>();

      for (const row of scheduleRows) {
        const day =
          normalizeDay(
            row.dayOfWeek
          );

        if (day) {
          set.add(day);
        }
      }

      return Array.from(set).sort(
        (a, b) =>
          DAY_NUMBER[
            a.toUpperCase()
          ] -
          DAY_NUMBER[
            b.toUpperCase()
          ]
      );
    }, [scheduleRows]);

  const todayLabel =
    DAY_LABELS[now.getDay()];

  const todayRows =
    useMemo(() => {
      if (!semesterStarted) {
        return [];
      }

      return scheduleRows
        .filter(
          (row) =>
            normalizeDay(
              row.dayOfWeek
            ) === todayLabel
        )
        .sort((a, b) => {
          const aRange =
            parseTimeRange(
              a.timeText
            );

          const bRange =
            parseTimeRange(
              b.timeText
            );

          if (!aRange || !bRange) {
            return 0;
          }

          return (
            aRange.start.hour * 60 +
            aRange.start.minute -
            (bRange.start.hour * 60 +
              bRange.start.minute)
          );
        });
    }, [
      scheduleRows,
      semesterStarted,
      todayLabel,
    ]);

  const nextOccurrence =
    useMemo(
      () =>
        getNextOccurrence(
          scheduleRows,
          now,
          semesterStarted
        ),
      [
        scheduleRows,
        now,
        semesterStarted,
      ]
    );

  const filteredDayRows =
    useMemo(() => {
      if (!selectedDay) {
        return [];
      }

      return scheduleRows
        .filter(
          (row) =>
            normalizeDay(
              row.dayOfWeek
            ) === selectedDay
        )
        .sort((a, b) => {
          const aRange =
            parseTimeRange(
              a.timeText
            );

          const bRange =
            parseTimeRange(
              b.timeText
            );

          if (!aRange || !bRange) {
            return 0;
          }

          return (
            aRange.start.hour * 60 +
            aRange.start.minute -
            (bRange.start.hour * 60 +
              bRange.start.minute)
          );
        });
    }, [
      scheduleRows,
      selectedDay,
    ]);

  const notifications =
    dashboard?.notifications?.recent ||
    [];

  const unreadCount =
    dashboard?.notifications
      ?.unreadCount || 0;

  const facultyInitial =
    dashboard?.teacher?.teacherCode ||
    effectiveSheet?.faculty?.initial ||
    "F";

  const facultyFullName =
    dashboard?.teacher?.fullName ||
    effectiveSheet?.faculty?.fullName ||
    "Faculty";

  const designation =
    dashboard?.teacher?.designation ||
    effectiveSheet?.faculty
      ?.designation ||
    "";

  const departmentCode =
    dashboard?.teacher
      ?.departmentCode ||
    effectiveSheet?.faculty
      ?.departmentCode ||
    "";

  const sessionRemainingText =
    useMemo(() => {
      if (
        !choiceIsOpen ||
        !dashboard?.session
          ?.expiresAt
      ) {
        return "";
      }

      const expiry = new Date(
        dashboard.session.expiresAt
      );

      if (
        Number.isNaN(
          expiry.getTime()
        )
      ) {
        return "";
      }

      const difference =
        expiry.getTime() -
        now.getTime();

      if (difference <= 0) {
        return "Session expired";
      }

      const totalMinutes =
        Math.max(
          1,
          Math.ceil(
            difference / 60000
          )
        );

      if (totalMinutes < 60) {
        return `${totalMinutes} min`;
      }

      const hours = Math.floor(
        totalMinutes / 60
      );

      const minutes =
        totalMinutes % 60;

      return minutes > 0
        ? `${hours}h ${minutes}m`
        : `${hours}h`;
    }, [
      choiceIsOpen,
      dashboard?.session?.expiresAt,
      now,
    ]);

  const loadProgress =
    useMemo(() => {
      if (
        maxCredits === null ||
        maxCredits <= 0
      ) {
        return 0;
      }

      return Math.min(
        100,
        Math.max(
          0,
          (totalCredits /
            maxCredits) *
            100
        )
      );
    }, [
      totalCredits,
      maxCredits,
    ]);

  async function loadSheets(
    term: string
  ) {
    const qs =
      new URLSearchParams();

    qs.set("termName", term);

    const [
      approvedRes,
      choiceRes,
    ] = await Promise.all([
      fetch(
        `/api/faculty/my-approved-assignment?${qs.toString()}`,
        {
          cache: "no-store",
        }
      ),

      fetch(
        `/api/faculty/my-load-sheet?${qs.toString()}`,
        {
          cache: "no-store",
        }
      ),
    ]);

    const approvedJson: SheetResponse =
      await approvedRes.json();

    const choiceJson: SheetResponse =
      await choiceRes.json();

    setApprovedSheet(
      approvedRes.ok
        ? approvedJson
        : null
    );

    setChoiceSheet(
      choiceRes.ok
        ? choiceJson
        : null
    );
  }

  async function loadDashboard(
    options?: {
      loadSheets?: boolean;
      showLoading?: boolean;
    }
  ) {
    const shouldLoadSheets =
      options?.loadSheets ?? false;

    const showLoading =
      options?.showLoading ?? false;

    if (showLoading) {
      setLoading(true);
    }

    setError("");

    try {
      const dashboardRes =
        await fetch(
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

      setDashboard(
        dashboardJson
      );

      const term =
        dashboardJson
          .visibleOfferingPool
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
      if (
        !current?.notifications
      ) {
        return current;
      }

      return {
        ...current,
        notifications: {
          unreadCount:
            Math.max(
              0,
              current.notifications
                .unreadCount - 1
            ),

          recent:
            current.notifications.recent.map(
              (item) =>
                item.id ===
                notification.id
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
      const response =
        await fetch(
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
      if (
        !current?.notifications
      ) {
        return current;
      }

      return {
        ...current,
        notifications: {
          unreadCount: 0,

          recent:
            current.notifications.recent.map(
              (item) => ({
                ...item,
                is_read: true,
              })
            ),
        },
      };
    });

    try {
      const response =
        await fetch(
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
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        }
      );
    } finally {
      window.location.href =
        "/auth/login";
    }
  }

  useEffect(() => {
    loadDashboard({
      loadSheets: true,
      showLoading: true,
    });
  }, []);

  useEffect(() => {
    const timer =
      window.setInterval(() => {
        loadDashboard({
          loadSheets: false,
          showLoading: false,
        });
      }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer =
      window.setInterval(() => {
        setNow(new Date());
      }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (
      teachingDays.length === 0
    ) {
      setSelectedDay("");
      return;
    }

    if (
      teachingDays.includes(
        todayLabel
      )
    ) {
      setSelectedDay(
        todayLabel
      );
      return;
    }

    setSelectedDay(
      teachingDays[0]
    );
  }, [
    teachingDays,
    todayLabel,
  ]);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      const target =
        event.target as Node;

      if (
        notificationPanelRef.current &&
        !notificationPanelRef.current.contains(
          target
        )
      ) {
        setNotificationOpen(
          false
        );
      }

      if (
        profilePanelRef.current &&
        !profilePanelRef.current.contains(
          target
        )
      ) {
        setProfileOpen(false);
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
    <main className="min-h-screen bg-[#f4f8fc]">
      <header className="sticky top-0 z-40 border-b border-[#d9e5f0] bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <UniFlowLogo
              href="/faculty/dashboard"
              compact
            />

            <div className="hidden min-w-0 xl:block">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#079db8]">
                Faculty Workspace
              </div>

              <div className="mt-1 truncate text-xs font-medium text-slate-500">
                {activeTermName || "Academic operations"}
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-xl border border-[#d9e5f0] bg-[#f4f8fc] p-1 md:flex">
            <a
              href="/faculty/dashboard"
              className="rounded-lg bg-[#0867b2] px-3 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Dashboard
            </a>

            <a
              href="#weekly-routine"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950"
            >
              My Routine
            </a>

            <a
              href="/faculty/course-choice"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950"
            >
              {choiceIsOpen
                ? "Course Choice"
                : "Final Choices"}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={manualRefresh}
              disabled={refreshing}
              aria-label="Refresh dashboard"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <span
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              >
                <RefreshIcon />
              </span>
            </button>

            <div
              ref={
                notificationPanelRef
              }
              className="relative"
            >
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={
                  notificationOpen
                }
                onClick={() => {
                  setNotificationOpen(
                    (current) =>
                      !current
                  );

                  setProfileOpen(false);
                }}
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                  notificationOpen
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <BellIcon />

                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
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
                        {unreadCount >
                        0
                          ? `${unreadCount} unread`
                          : "You're all caught up"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        clearAllNotifications
                      }
                      disabled={
                        unreadCount === 0
                      }
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800 disabled:text-slate-400"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-[460px] overflow-y-auto">
                    {notifications.length >
                    0 ? (
                      notifications.map(
                        (
                          notification
                        ) => (
                          <button
                            type="button"
                            key={
                              notification.id
                            }
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
                                {
                                  notification.title
                                }
                              </div>

                              <p className="mt-1 text-sm leading-5 text-slate-600">
                                {
                                  notification.message
                                }
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
                          New academic
                          updates will appear
                          here.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div
              ref={profilePanelRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(
                    (current) =>
                      !current
                  );

                  setNotificationOpen(
                    false
                  );
                }}
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white pl-1.5 pr-2.5 text-slate-700 transition hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0867b2] text-xs font-bold uppercase text-white">
                  {facultyInitial}
                </span>

                <span className="hidden max-w-36 truncate text-sm font-semibold lg:block">
                  {facultyFullName}
                </span>

                <ChevronIcon />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="border-b border-slate-100 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0867b2] text-sm font-black uppercase text-white">
                        {facultyInitial}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-950">
                          {facultyFullName}
                        </div>

                        <div className="truncate text-xs text-slate-500">
                          {designation ||
                            departmentCode ||
                            "Faculty"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-2">
                    <a
                      href="#weekly-routine"
                      onClick={() =>
                        setProfileOpen(
                          false
                        )
                      }
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      My Weekly Routine
                    </a>

                    {activeTermName && (
                      <a
                        href={`/api/faculty/my-approved-assignment/export?termName=${encodeURIComponent(
                          activeTermName
                        )}`}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Export My Schedule
                      </a>
                    )}

                    {activeTermName && (
                      <a
                        href={`/api/faculty/my-load-sheet/export?termName=${encodeURIComponent(
                          activeTermName
                        )}`}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Export Load Sheet
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={logout}
                      className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading &&
        !dashboard ? (
          <>
            <div className="animate-pulse rounded-3xl bg-slate-900 p-6 sm:p-8">
              <div className="h-3 w-28 rounded bg-slate-700" />
              <div className="mt-5 h-9 w-64 rounded bg-slate-700" />
              <div className="mt-3 h-4 w-80 max-w-full rounded bg-slate-800" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        ) : dashboard ? (
          <>
            <section className="overflow-hidden rounded-3xl border border-[#079db8]/20 bg-gradient-to-br from-white via-[#edf6ff] to-[#eafafb] text-slate-900 shadow-sm">
              <div className="relative p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#079db8]/20 blur-3xl" />

                <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#4dc21f]/10 blur-3xl" />

                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                        {
                          semesterContext.eyebrow
                        }
                      </span>

                      {assignmentReady && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          ✓{" "}
                          {
                            assignmentStatusText
                          }
                        </span>
                      )}

                      {choiceIsOpen && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(
                            dashboard
                              .policy
                              ?.windowStatus ||
                              ""
                          )}`}
                        >
                          Faculty Choice{" "}
                          {
                            dashboard
                              .policy
                              ?.windowStatus
                          }
                        </span>
                      )}
                    </div>

                    <div className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#0867b2]">
                      FALL 2026
                    </div>

                    <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                      {
                        semesterContext.title
                      }
                    </h1>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                      {
                        semesterContext.subtitle
                      }
                    </p>

                    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                      <span>
                        Semester start:{" "}
                        <strong className="text-slate-950">
                          1 September
                          2026
                        </strong>
                      </span>

                      <span>
                        Today:{" "}
                        <strong className="text-slate-950">
                          {formatDisplayDate(
                            now
                          )}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href="#weekly-routine"
                      className="inline-flex items-center justify-center rounded-xl bg-[#0867b2] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#075491] focus:outline-none focus:ring-2 focus:ring-[#079db8]/30"
                    >
                      View Weekly Routine
                    </a>

                    {choiceIsOpen ? (
                      <a
                        href="/faculty/course-choice"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        {dashboard
                          .policy
                          ?.canActNow
                          ? "Open Course Choice"
                          : "View Course Choice"}
                      </a>
                    ) : (
                      <a
                        href="/faculty/course-choice"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        View Final Choices
                      </a>
                    )}
                  </div>
                </div>

                <div className="relative mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assignment
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {assignmentReady
                        ? "Finalized"
                        : "Preparing"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Routine
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {scheduleRows.length >
                      0
                        ? "Available"
                        : "Not available"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Faculty
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {facultyInitial} ·{" "}
                      {departmentCode ||
                        "Faculty"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Choice Session
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {choiceIsOpen
                        ? sessionRemainingText ||
                          "Open"
                        : "Completed"}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Semester Overview
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Teaching Load"
                  value={`${totalCredits} cr`}
                  helper={
                    maxCredits === null
                      ? "Current assigned load"
                      : `Maximum ${maxCredits} credits`
                  }
                  icon={
                    <BookIcon />
                  }
                  emphasis
                />

                <MetricCard
                  label="Assigned Courses"
                  value={String(
                    courseSummaries.length
                  )}
                  helper="This semester"
                  icon={
                    <BookIcon />
                  }
                />

                <MetricCard
                  label="Teaching Days"
                  value={String(
                    teachingDays.length
                  )}
                  helper="Days per week"
                  icon={
                    <CalendarIcon />
                  }
                />

                <MetricCard
                  label={
                    semesterStarted
                      ? "Next Class"
                      : "First Class"
                  }
                  value={
                    nextOccurrence
                      ? combinedCourseCodes(
                          nextOccurrence.row.courseCode,
                          nextOccurrence.row.coOfferedCourseCodes
                        )
                      : "No class"
                  }
                  helper={
                    nextOccurrence
                      ? `${formatShortDate(
                          nextOccurrence.start
                        )} · ${formatClock(
                          nextOccurrence.start
                        )}`
                      : "No scheduled meeting found"
                  }
                  icon={
                    <ClockIcon />
                  }
                />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {semesterStarted
                        ? `Today's Classes · ${todayLabel}`
                        : "Semester Preparation"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {semesterStarted
                        ? formatDisplayDate(
                            now
                          )
                        : "Your first teaching week begins from 1 September 2026."}
                    </p>
                  </div>

                  {semesterStarted &&
                    todayRows.length >
                      0 && (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {
                          todayRows.length
                        }{" "}
                        class
                        {todayRows.length ===
                        1
                          ? ""
                          : "es"}{" "}
                        today
                      </span>
                    )}
                </div>

                <div className="p-5">
                  {semesterStarted ? (
                    todayRows.length >
                    0 ? (
                      <div className="space-y-3">
                        {todayRows.map(
                          (
                            row,
                            index
                          ) => (
                            <div
                              key={`${combinedCourseCodes(row.courseCode, row.coOfferedCourseCodes)}-${row.section}-${row.timeText}-${index}`}
                              className="group flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/30 sm:flex-row sm:items-center"
                            >
                              <div className="flex w-full shrink-0 items-center gap-3 sm:w-36">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                                  <ClockIcon />
                                </div>

                                <div>
                                  <div className="text-sm font-bold text-slate-950">
                                    {
                                      row.timeText
                                    }
                                  </div>

                                  <div className="text-xs text-slate-500">
                                    {
                                      row.roomText
                                    }
                                  </div>
                                </div>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-950">
                                    {
                                      row.courseCode
                                    }
                                  </span>

                                  <span className="text-sm text-slate-500">
                                    Sec{" "}
                                    {
                                      row.section
                                    }
                                  </span>

                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryBadgeClasses(
                                      row.category
                                    )}`}
                                  >
                                    {
                                      row.category
                                    }
                                  </span>
                                </div>

                                <div className="mt-1 truncate text-sm text-slate-600">
                                  {
                                    row.courseTitle
                                  }
                                </div>

                                {row.batchCodes
                                  ?.length >
                                  0 && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    Batch:{" "}
                                    {row.batchCodes.join(
                                      ", "
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-slate-50 px-5 py-10 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                          <CalendarIcon />
                        </div>

                        <div className="mt-4 font-semibold text-slate-800">
                          No classes today
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          Your next
                          scheduled class
                          appears beside this
                          panel.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl bg-emerald-50 p-4">
                        <div className="text-sm font-semibold text-emerald-800">
                          ✓ Assignment
                        </div>

                        <div className="mt-2 text-sm text-emerald-700">
                          {assignmentReady
                            ? "Your faculty assignment is ready."
                            : "Assignment preparation is ongoing."}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-blue-50 p-4">
                        <div className="text-sm font-semibold text-blue-800">
                          ✓ Routine
                        </div>

                        <div className="mt-2 text-sm text-blue-700">
                          {scheduleRows.length >
                          0
                            ? "Your weekly routine is available."
                            : "Routine is being prepared."}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-violet-50 p-4">
                        <div className="text-sm font-semibold text-violet-800">
                          Semester Start
                        </div>

                        <div className="mt-2 text-sm text-violet-700">
                          Tuesday, 1
                          September
                          2026
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {semesterStarted
                    ? "Next Class"
                    : "First Scheduled Class"}
                </div>

                {nextOccurrence ? (
                  <div className="mt-4">
                    <div className="text-2xl font-black tracking-tight text-slate-950">
                      {
                        combinedCourseCodes(
                          combinedCourseCodes(
                          combinedCourseCodes(
                          combinedCourseCodes(
                          nextOccurrence.row.courseCode,
                          nextOccurrence.row.coOfferedCourseCodes
                        ),
                          nextOccurrence.row.coOfferedCourseCodes
                        ),
                          nextOccurrence.row.coOfferedCourseCodes
                        ),
                          nextOccurrence.row.coOfferedCourseCodes
                        )
                      }
                    </div>

                    <div className="mt-1 text-sm font-medium text-slate-600">
                      {
                        nextOccurrence
                          .row
                          .courseTitle
                      }
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-slate-400">
                          <CalendarIcon />
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {formatShortDate(
                              nextOccurrence.start
                            )}
                          </div>

                          <div className="text-xs text-slate-500">
                            Section{" "}
                            {
                              nextOccurrence
                                .row
                                .section
                            }
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-slate-400">
                          <ClockIcon />
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {
                              nextOccurrence
                                .row
                                .timeText
                            }
                          </div>

                          <div className="text-xs text-slate-500">
                            {
                              nextOccurrence
                                .row
                                .roomText
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl bg-blue-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Starts in
                      </div>

                      <div className="mt-1 text-lg font-bold text-blue-950">
                        {countdownText(
                          nextOccurrence.start,
                          now
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No scheduled
                    class found.
                  </div>
                )}
              </aside>
            </section>

            <FacultyTeachingPlanner />

            <section
              id="weekly-routine"
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      My Weekly Routine
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Select a teaching
                      day to view your
                      scheduled classes.
                    </p>
                  </div>

                  <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                    {teachingDays.map(
                      (day) => (
                        <button
                          type="button"
                          key={day}
                          onClick={() =>
                            setSelectedDay(
                              day
                            )
                          }
                          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            selectedDay ===
                            day
                              ? "bg-slate-950 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {day.slice(
                            0,
                            3
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5">
                {teachingDays.length >
                0 ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredDayRows.map(
                      (
                        row,
                        index
                      ) => (
                        <div
                          key={`${selectedDay}-${combinedCourseCodes(row.courseCode, row.coOfferedCourseCodes)}-${row.section}-${row.timeText}-${index}`}
                          className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-slate-950">
                                {
                                  row.courseCode
                                }
                              </div>

                              <div className="mt-1 text-xs font-medium text-slate-500">
                                Section{" "}
                                {
                                  row.section
                                }
                              </div>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryBadgeClasses(
                                row.category
                              )}`}
                            >
                              {
                                row.category
                              }
                            </span>
                          </div>

                          <div className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-600">
                            {
                              row.courseTitle
                            }
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                Time
                              </div>

                              <div className="mt-1 font-semibold text-slate-800">
                                {
                                  row.timeText
                                }
                              </div>
                            </div>

                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                Room
                              </div>

                              <div className="mt-1 font-semibold text-slate-800">
                                {
                                  row.roomText
                                }
                              </div>
                            </div>
                          </div>

                          {row.batchCodes
                            ?.length >
                            0 && (
                            <div className="mt-3 text-xs text-slate-500">
                              Batch:{" "}
                              {row.batchCodes.join(
                                ", "
                              )}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                    No weekly routine
                    is currently
                    available.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5">
                <h2 className="text-lg font-semibold text-slate-950">
                  My Courses
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your assigned courses
                  for the current
                  semester.
                </p>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {courseSummaries.map(
                  (course) => (
                    <article
                      key={
                        course.key
                      }
                      className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-black tracking-tight text-slate-950">
                            {
                              course.courseCode
                            }
                          </div>

                          <div className="mt-1 text-xs font-medium text-slate-500">
                            Section{" "}
                            {
                              course.section
                            }{" "}
                            ·{" "}
                            {
                              course.credit
                            }{" "}
                            cr
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryBadgeClasses(
                            course.category
                          )}`}
                        >
                          {
                            course.category
                          }
                        </span>
                      </div>

                      <div className="mt-3 text-sm font-medium leading-5 text-slate-700">
                        {
                          course.courseTitle
                        }
                      </div>

                      <div className="mt-4 space-y-2">
                        {course.meetings.map(
                          (
                            meeting,
                            index
                          ) => {
                            const day =
                              normalizeDay(
                                meeting.dayOfWeek
                              );

                            if (
                              !day
                            ) {
                              return null;
                            }

                            return (
                              <div
                                key={`${meeting.dayOfWeek}-${meeting.timeText}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs"
                              >
                                <span className="font-semibold text-slate-700">
                                  {
                                    day
                                  }
                                </span>

                                <span className="text-right text-slate-500">
                                  {
                                    meeting.timeText
                                  }{" "}
                                  ·{" "}
                                  {
                                    meeting.roomText
                                  }
                                </span>
                              </div>
                            );
                          }
                        )}
                      </div>

                      {course.batchCodes
                        .length >
                        0 && (
                        <div className="mt-3 text-xs text-slate-500">
                          Batch:{" "}
                          {course.batchCodes.join(
                            ", "
                          )}
                        </div>
                      )}
                    </article>
                  )
                )}

                {courseSummaries.length ===
                  0 && (
                  <div className="md:col-span-2 xl:col-span-3">
                    <div className="rounded-2xl bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                      No assigned
                      courses found.
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Teaching Load
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Finalized load
                      against your
                      configured credit
                      policy.
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-2xl font-black text-slate-950">
                      {
                        totalCredits
                      }
                      {maxCredits !==
                        null && (
                        <span className="text-base font-medium text-slate-400">
                          {" "}
                          /{" "}
                          {
                            maxCredits
                          }
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500">
                      credits
                    </div>
                  </div>
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-500"
                    style={{
                      width: `${loadProgress}%`,
                    }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap justify-between gap-3 text-xs text-slate-500">
                  <span>
                    Min{" "}
                    {numberText(
                      minCredits
                    )}
                  </span>

                  <span>
                    Current{" "}
                    {
                      totalCredits
                    }
                  </span>

                  <span>
                    Max{" "}
                    {numberText(
                      maxCredits
                    )}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-blue-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                      Theory
                    </div>

                    <div className="mt-2 text-2xl font-black text-blue-950">
                      {
                        theoryCredits
                      }
                    </div>

                    <div className="text-xs text-blue-700">
                      credits
                    </div>
                  </div>

                  <div className="rounded-2xl bg-violet-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                      Lab
                    </div>

                    <div className="mt-2 text-2xl font-black text-violet-950">
                      {
                        labCredits
                      }
                    </div>

                    <div className="text-xs text-violet-700">
                      credits
                    </div>
                  </div>
                </div>
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-950">
                  Quick Actions
                </h2>

                <div className="mt-4 space-y-2">
                  <a
                    href="#weekly-routine"
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    My Weekly Routine
                    <span>→</span>
                  </a>

                  {activeTermName && (
                    <a
                      href={`/api/faculty/my-approved-assignment/export?termName=${encodeURIComponent(
                        activeTermName
                      )}`}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Export Schedule
                      <span>↓</span>
                    </a>
                  )}

                  {activeTermName && (
                    <a
                      href={`/api/faculty/my-load-sheet/export?termName=${encodeURIComponent(
                        activeTermName
                      )}`}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Export Load Sheet
                      <span>↓</span>
                    </a>
                  )}

                  <a
                    href="/faculty/course-choice"
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {choiceIsOpen
                      ? "Course Choice"
                      : "View Final Choices"}
                    <span>→</span>
                  </a>
                </div>
              </aside>
            </section>

            <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Faculty & Academic
                    Details
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Profile, credit
                    distribution and
                    detailed schedule.
                  </p>
                </div>

                <span className="transition group-open:rotate-180">
                  <ChevronIcon />
                </span>
              </summary>

              <div className="border-t border-slate-100 p-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Faculty
                    </div>

                    <div className="mt-1 font-semibold text-slate-950">
                      {
                        facultyFullName
                      }
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Initial:{" "}
                      {
                        facultyInitial
                      }
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Department
                    </div>

                    <div className="mt-1 font-semibold text-slate-950">
                      {departmentCode ||
                        "-"}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {dashboard
                        .teacher
                        ?.departmentName ||
                        "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Designation
                    </div>

                    <div className="mt-1 font-semibold text-slate-950">
                      {designation ||
                        "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Seniority
                    </div>

                    <div className="mt-1 font-semibold text-slate-950">
                      {dashboard
                        .teacher
                        ?.seniorityLevel
                        ? `Position ${dashboard.teacher.seniorityLevel}`
                        : "-"}
                    </div>
                  </div>
                </div>

                {(effectiveSheet
                  ?.programTallies
                  ?.length || 0) >
                  0 && (
                  <div className="mt-7">
                    <h3 className="text-base font-semibold text-slate-950">
                      Program-wise Credit
                      Distribution
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
                          {(
                            effectiveSheet?.programTallies ||
                            []
                          ).map(
                            (
                              item
                            ) => (
                              <tr
                                key={
                                  item.programCode
                                }
                              >
                                <td className="border-b border-slate-100 px-4 py-3 font-medium">
                                  {
                                    item.programCode
                                  }
                                </td>

                                <td className="border-b border-slate-100 px-4 py-3">
                                  {
                                    item.theoryCredits
                                  }
                                </td>

                                <td className="border-b border-slate-100 px-4 py-3">
                                  {
                                    item.labCredits
                                  }
                                </td>

                                <td className="border-b border-slate-100 px-4 py-3 font-semibold">
                                  {
                                    item.totalCredits
                                  }
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mt-7">
                  <h3 className="text-base font-semibold text-slate-950">
                    Detailed Schedule
                  </h3>

                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="border-b px-4 py-3 text-left font-semibold">
                            Course
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
                            Type
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {scheduleRows.map(
                          (
                            row,
                            index
                          ) => (
                            <tr
                              key={`${combinedCourseCodes(row.courseCode, row.coOfferedCourseCodes)}-${row.section}-${row.dayOfWeek}-${row.timeText}-${index}`}
                              className="hover:bg-slate-50"
                            >
                              <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-950">
                                {
                                  row.courseCode
                                }
                              </td>

                              <td className="border-b border-slate-100 px-4 py-3">
                                {
                                  row.section
                                }
                              </td>

                              <td className="border-b border-slate-100 px-4 py-3">
                                {
                                  row.credit
                                }
                              </td>

                              <td className="border-b border-slate-100 px-4 py-3">
                                {
                                  row.dayOfWeek
                                }
                              </td>

                              <td className="border-b border-slate-100 px-4 py-3">
                                {
                                  row.timeText
                                }
                              </td>

                              <td className="border-b border-slate-100 px-4 py-3">
                                {
                                  row.roomText
                                }
                              </td>

                              <td className="border-b border-slate-100 px-4 py-3">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryBadgeClasses(
                                    row.category
                                  )}`}
                                >
                                  {
                                    row.category
                                  }
                                </span>
                              </td>
                            </tr>
                          )
                        )}

                        {scheduleRows.length ===
                          0 && (
                          <tr>
                            <td
                              colSpan={
                                7
                              }
                              className="px-4 py-8 text-center text-slate-500"
                            >
                              No detailed
                              schedule rows
                              found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </details>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-slate-500 shadow-sm">
            No faculty-visible semester is
            currently opened by
            coordinator/admin.
          </div>
        )}
      </div>
    </main>
  );
}
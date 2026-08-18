"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type PlannerNoteType =
  | "CLASS_NOTE"
  | "REMINDER"
  | "ASSESSMENT"
  | "PERSONAL";

type PlannerNote = {
  id: number;
  teacher_id: number;
  academic_term_id: number;
  offered_course_id: number | null;
  note_date: string;
  note_type: PlannerNoteType;
  title: string | null;
  note_text: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  course_code: string | null;
  course_title: string | null;
  section: string | null;
};

type PlannerResponse = {
  success?: boolean;
  error?: string;
  academicTerm?: {
    id: number;
    name: string;
  };
  month?: string;
  notes?: PlannerNote[];
};

type PlannerScheduleRow = {
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

type ScheduleResponse = {
  success?: boolean;
  error?: string;
  termName?: string;
  scheduleRows?: PlannerScheduleRow[];
};

type PlannerForm = {
  id: number | null;
  noteDate: string;
  noteType: PlannerNoteType;
  offeredCourseId: string;
  title: string;
  noteText: string;
  isCompleted: boolean;
};

type CourseOption = {
  offeredCourseId: number;
  courseCode: string;
  displayCourseCode: string;
  courseTitle: string;
  section: string;
};

const DAY_HEADERS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const DAY_NUMBER: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const NOTE_TYPES: Array<{
  value: PlannerNoteType;
  label: string;
}> = [
  {
    value: "CLASS_NOTE",
    label: "Class Note",
  },
  {
    value: "REMINDER",
    label: "Reminder",
  },
  {
    value: "ASSESSMENT",
    label: "Assessment",
  },
  {
    value: "PERSONAL",
    label: "Personal",
  },
];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  return `${year}-${month}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    0
  );
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function fullDateTitle(value: string) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(fromDateKey(value));
}

function resolveAutomaticTerm(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month >= 1 && month <= 4) {
    return `SPRING ${year}`;
  }

  if (month >= 5 && month <= 8) {
    return `SUMMER ${year}`;
  }

  return `FALL ${year}`;
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

function noteTypeLabel(
  type: PlannerNoteType
) {
  return (
    NOTE_TYPES.find(
      (item) => item.value === type
    )?.label || type
  );
}

function noteTypeClasses(
  type: PlannerNoteType
) {
  if (type === "CLASS_NOTE") {
    return {
      dot: "bg-blue-600",
      badge:
        "bg-blue-50 text-blue-700",
      border: "border-blue-200",
    };
  }

  if (type === "REMINDER") {
    return {
      dot: "bg-amber-500",
      badge:
        "bg-amber-50 text-amber-700",
      border: "border-amber-200",
    };
  }

  if (type === "ASSESSMENT") {
    return {
      dot: "bg-violet-600",
      badge:
        "bg-violet-50 text-violet-700",
      border: "border-violet-200",
    };
  }

  return {
    dot: "bg-slate-500",
    badge:
      "bg-slate-100 text-slate-700",
    border: "border-slate-200",
  };
}

function normalizeDay(
  day: string
) {
  return String(day || "")
    .trim()
    .toUpperCase();
}

function scheduleOccursOnDate(
  row: PlannerScheduleRow,
  date: Date
) {
  const expected =
    DAY_NUMBER[
      normalizeDay(row.dayOfWeek)
    ];

  return (
    expected !== undefined &&
    expected === date.getDay()
  );
}

function createEmptyForm(
  dateKey: string
): PlannerForm {
  return {
    id: null,
    noteDate: dateKey,
    noteType: "CLASS_NOTE",
    offeredCourseId: "",
    title: "",
    noteText: "",
    isCompleted: false,
  };
}

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M5 12l4 4L19 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FacultyTeachingPlanner() {
  const initialToday = useMemo(
    () => new Date(),
    []
  );

  const [visibleMonth, setVisibleMonth] =
    useState(
      () =>
        new Date(
          initialToday.getFullYear(),
          initialToday.getMonth(),
          1
        )
    );

  const [selectedDate, setSelectedDate] =
    useState(
      () => toDateKey(initialToday)
    );

  const [termMode, setTermMode] =
    useState("AUTO");

  const [notes, setNotes] = useState<
    PlannerNote[]
  >([]);

  const [scheduleRows, setScheduleRows] =
    useState<PlannerScheduleRow[]>([]);

  const [
    academicTermId,
    setAcademicTermId,
  ] = useState<number | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  const [editorOpen, setEditorOpen] =
    useState(false);

  const [form, setForm] =
    useState<PlannerForm>(
      createEmptyForm(
        toDateKey(initialToday)
      )
    );

  const monthKey =
    toMonthKey(visibleMonth);

  const visibleYear =
    visibleMonth.getFullYear();

  const automaticTerm =
    resolveAutomaticTerm(
      visibleMonth
    );

  const resolvedTerm =
    termMode === "AUTO"
      ? automaticTerm
      : termMode;

  const termOptions = useMemo(
    () => [
      `SPRING ${visibleYear}`,
      `SUMMER ${visibleYear}`,
      `FALL ${visibleYear}`,
    ],
    [visibleYear]
  );

  const courseOptions =
    useMemo<CourseOption[]>(() => {
      const map = new Map<
        number,
        CourseOption
      >();

      for (const row of scheduleRows) {
        const id =
          row.offeredCourseId;

        if (
          !id ||
          map.has(id)
        ) {
          continue;
        }

        map.set(id, {
          offeredCourseId: id,
          courseCode: row.courseCode,
          displayCourseCode: combinedCourseCodes(
            row.courseCode,
            row.coOfferedCourseCodes
          ),
          courseTitle: row.courseTitle,
          section: row.section,
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

  const loadPlannerContext =
    useCallback(
      async (
        termName: string,
        month: string
      ) => {
        setLoading(true);
        setError("");

        try {
          const plannerParams =
            new URLSearchParams();

          plannerParams.set(
            "termName",
            termName
          );

          plannerParams.set(
            "month",
            month
          );

          const scheduleParams =
            new URLSearchParams();

          scheduleParams.set(
            "termName",
            termName
          );

          const [
            plannerResponse,
            scheduleResponse,
          ] = await Promise.all([
            fetch(
              `/api/faculty/planner?${plannerParams.toString()}`,
              {
                cache: "no-store",
              }
            ),
            fetch(
              `/api/faculty/my-approved-assignment?${scheduleParams.toString()}`,
              {
                cache: "no-store",
              }
            ),
          ]);

          let plannerJson: PlannerResponse =
            {};

          try {
            plannerJson =
              await plannerResponse.json();
          } catch {
            plannerJson = {};
          }

          let scheduleJson: ScheduleResponse =
            {};

          try {
            scheduleJson =
              await scheduleResponse.json();
          } catch {
            scheduleJson = {};
          }

          if (
            plannerResponse.ok
          ) {
            setNotes(
              plannerJson.notes || []
            );

            setAcademicTermId(
              plannerJson
                .academicTerm?.id ||
                null
            );
          } else if (
            plannerResponse.status ===
            404
          ) {
            setNotes([]);
            setAcademicTermId(null);
          } else {
            throw new Error(
              plannerJson.error ||
                "Failed to load planner."
            );
          }

          if (
            scheduleResponse.ok
          ) {
            setScheduleRows(
              scheduleJson.scheduleRows ||
                []
            );
          } else if (
            scheduleResponse.status ===
            404
          ) {
            setScheduleRows([]);
          } else {
            throw new Error(
              scheduleJson.error ||
                "Failed to load faculty routine."
            );
          }
        } catch (err) {
          setNotes([]);
          setScheduleRows([]);

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load teaching planner."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        loadPlannerContext(
          resolvedTerm,
          monthKey
        );
      }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    resolvedTerm,
    monthKey,
    loadPlannerContext,
  ]);

  const calendarDays =
    useMemo(() => {
      const year =
        visibleMonth.getFullYear();

      const month =
        visibleMonth.getMonth();

      const first = new Date(
        year,
        month,
        1
      );

      const last = new Date(
        year,
        month + 1,
        0
      );

      const cells: Array<
        Date | null
      > = [];

      for (
        let i = 0;
        i < first.getDay();
        i += 1
      ) {
        cells.push(null);
      }

      for (
        let day = 1;
        day <= last.getDate();
        day += 1
      ) {
        cells.push(
          new Date(
            year,
            month,
            day
          )
        );
      }

      while (
        cells.length % 7 !== 0
      ) {
        cells.push(null);
      }

      return cells;
    }, [visibleMonth]);

  const notesByDate =
    useMemo(() => {
      const map = new Map<
        string,
        PlannerNote[]
      >();

      for (const note of notes) {
        const list =
          map.get(
            note.note_date
          ) || [];

        list.push(note);

        map.set(
          note.note_date,
          list
        );
      }

      return map;
    }, [notes]);

  const selectedNotes =
    useMemo(
      () =>
        (
          notesByDate.get(
            selectedDate
          ) || []
        ).sort((a, b) =>
          a.created_at.localeCompare(
            b.created_at
          )
        ),
      [
        notesByDate,
        selectedDate,
      ]
    );

  const selectedDateObject =
    useMemo(
      () =>
        fromDateKey(
          selectedDate
        ),
      [selectedDate]
    );

  const selectedClasses =
    useMemo(
      () =>
        scheduleRows.filter(
          (row) =>
            scheduleOccursOnDate(
              row,
              selectedDateObject
            )
        ),
      [
        scheduleRows,
        selectedDateObject,
      ]
    );

  const upcomingItems =
    useMemo(() => {
      const todayKey =
        toDateKey(new Date());

      return notes
        .filter(
          (note) =>
            note.note_date >=
              todayKey &&
            (note.note_type ===
              "REMINDER" ||
              note.note_type ===
                "ASSESSMENT") &&
            !note.is_completed
        )
        .sort((a, b) =>
          a.note_date.localeCompare(
            b.note_date
          )
        )
        .slice(0, 6);
    }, [notes]);

  const previousClassNote =
    useMemo(() => {
      if (
        !form.offeredCourseId
      ) {
        return null;
      }

      const courseId = Number(
        form.offeredCourseId
      );

      return (
        notes
          .filter(
            (note) =>
              note.offered_course_id ===
                courseId &&
              note.note_type ===
                "CLASS_NOTE" &&
              note.note_date <
                form.noteDate
          )
          .sort((a, b) =>
            b.note_date.localeCompare(
              a.note_date
            )
          )[0] || null
      );
    }, [
      notes,
      form.offeredCourseId,
      form.noteDate,
    ]);

  function moveMonth(
    offset: number
  ) {
    const next = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() +
        offset,
      1
    );

    setVisibleMonth(next);

    setSelectedDate(
      toDateKey(next)
    );

    setDrawerOpen(false);
    setEditorOpen(false);

    if (
      termMode !== "AUTO" &&
      !termMode.endsWith(
        String(next.getFullYear())
      )
    ) {
      setTermMode("AUTO");
    }
  }

  function goToday() {
    const now = new Date();

    setVisibleMonth(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )
    );

    setSelectedDate(
      toDateKey(now)
    );

    setTermMode("AUTO");
    setDrawerOpen(true);
    setEditorOpen(false);
  }

  function selectDay(
    date: Date
  ) {
    setSelectedDate(
      toDateKey(date)
    );

    setDrawerOpen(true);
    setEditorOpen(false);
  }

  function openNewNote(
    preferredCourseId?: number
  ) {
    setForm({
      ...createEmptyForm(
        selectedDate
      ),
      offeredCourseId:
        preferredCourseId
          ? String(
              preferredCourseId
            )
          : "",
    });

    setEditorOpen(true);
  }

  function openEditNote(
    note: PlannerNote
  ) {
    setForm({
      id: note.id,
      noteDate:
        note.note_date,
      noteType:
        note.note_type,
      offeredCourseId:
        note.offered_course_id
          ? String(
              note.offered_course_id
            )
          : "",
      title: note.title || "",
      noteText:
        note.note_text,
      isCompleted:
        note.is_completed,
    });

    setEditorOpen(true);
  }

  async function refreshCurrentContext() {
    await loadPlannerContext(
      resolvedTerm,
      monthKey
    );
  }

  async function saveNote() {
    if (!academicTermId) {
      setError(
        `${resolvedTerm} is not available as an academic term for planner entries.`
      );
      return;
    }

    if (!form.noteText.trim()) {
      setError(
        "A note is required."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const isEdit =
        form.id !== null;

      const response =
        await fetch(
          isEdit
            ? `/api/faculty/planner/${form.id}`
            : "/api/faculty/planner",
          {
            method: isEdit
              ? "PATCH"
              : "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              isEdit
                ? {
                    offeredCourseId:
                      form.offeredCourseId ||
                      null,
                    noteDate:
                      form.noteDate,
                    noteType:
                      form.noteType,
                    title:
                      form.title,
                    noteText:
                      form.noteText,
                    isCompleted:
                      form.isCompleted,
                  }
                : {
                    academicTermId,
                    offeredCourseId:
                      form.offeredCourseId ||
                      null,
                    noteDate:
                      form.noteDate,
                    noteType:
                      form.noteType,
                    title:
                      form.title,
                    noteText:
                      form.noteText,
                  }
            ),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Failed to save planner note."
        );
      }

      setEditorOpen(false);

      await refreshCurrentContext();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save planner note."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(
    note: PlannerNote
  ) {
    setError("");

    try {
      const response =
        await fetch(
          `/api/faculty/planner/${note.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              isCompleted:
                !note.is_completed,
            }),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Failed to update planner item."
        );
      }

      setNotes((current) =>
        current.map((item) =>
          item.id === note.id
            ? {
                ...item,
                is_completed:
                  !item.is_completed,
              }
            : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update planner item."
      );
    }
  }

  async function deleteNote(
    note: PlannerNote
  ) {
    if (
      !window.confirm(
        "Delete this planner note?"
      )
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/faculty/planner/${note.id}`,
          {
            method: "DELETE",
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Failed to delete planner note."
        );
      }

      setNotes((current) =>
        current.filter(
          (item) =>
            item.id !== note.id
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete planner note."
      );
    }
  }

  return (
    <>
      <section
        id="teaching-planner"
        className="rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Teaching Planner
              </h2>

              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                Personal faculty workspace
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Calendar-aware class notes,
              reminders and assessments.
            </p>
          </div>

          <button
            type="button"
            onClick={goToday}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Today
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Academic calendar context
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-950 shadow-sm ring-1 ring-slate-200">
                  {resolvedTerm}
                </span>

                {termMode ===
                  "AUTO" && (
                  <span className="text-xs text-slate-500">
                    Automatically selected
                    from{" "}
                    {monthTitle(
                      visibleMonth
                    )}
                  </span>
                )}
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">
                Term control
              </span>

              <select
                value={termMode}
                onChange={(event) => {
                  setTermMode(
                    event.target.value
                  );
                  setDrawerOpen(false);
                  setEditorOpen(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="AUTO">
                  Auto by calendar month
                </option>

                {termOptions.map(
                  (term) => (
                    <option
                      key={term}
                      value={term}
                    >
                      {term}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
              Jan–Apr → Spring
            </span>

            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
              May–Aug → Summer
            </span>

            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
              Sep–Dec → Fall
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  moveMonth(-1)
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                aria-label="Previous month"
              >
                <ChevronLeft />
              </button>

              <div className="text-center">
                <div className="font-semibold text-slate-950">
                  {monthTitle(
                    visibleMonth
                  )}
                </div>

                <div className="mt-0.5 text-xs text-slate-500">
                  {loading
                    ? `Loading ${resolvedTerm}...`
                    : `${scheduleRows.length} routine row${
                        scheduleRows.length ===
                        1
                          ? ""
                          : "s"
                      } · ${
                        notes.length
                      } planner item${
                        notes.length ===
                        1
                          ? ""
                          : "s"
                      }`}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  moveMonth(1)
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                aria-label="Next month"
              >
                <ChevronRight />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-1">
              {DAY_HEADERS.map(
                (day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {day}
                  </div>
                )
              )}

              {calendarDays.map(
                (date, index) => {
                  if (!date) {
                    return (
                      <div
                        key={`blank-${index}`}
                        className="min-h-20 rounded-xl sm:min-h-24"
                      />
                    );
                  }

                  const key =
                    toDateKey(date);

                  const dayNotes =
                    notesByDate.get(
                      key
                    ) || [];

                  const classes =
                    scheduleRows.filter(
                      (row) =>
                        scheduleOccursOnDate(
                          row,
                          date
                        )
                    );

                  const isToday =
                    key ===
                    toDateKey(
                      new Date()
                    );

                  const isSelected =
                    key ===
                    selectedDate;

                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() =>
                        selectDay(date)
                      }
                      className={`relative min-h-20 rounded-xl border p-1.5 text-left transition sm:min-h-24 sm:p-2 ${
                        isSelected
                          ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                          : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={`flex h-6 min-w-6 items-center justify-center rounded-lg px-1 text-xs font-semibold ${
                            isToday
                              ? "bg-slate-950 text-white"
                              : "text-slate-700"
                          }`}
                        >
                          {date.getDate()}
                        </span>

                        {classes.length >
                          0 && (
                          <span className="hidden rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 sm:inline">
                            {
                              classes.length
                            }{" "}
                            class
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {classes.length >
                          0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        )}

                        {dayNotes
                          .slice(0, 4)
                          .map(
                            (note) => (
                              <span
                                key={
                                  note.id
                                }
                                className={`h-1.5 w-1.5 rounded-full ${
                                  noteTypeClasses(
                                    note.note_type
                                  ).dot
                                }`}
                              />
                            )
                          )}
                      </div>

                      <div className="mt-2 hidden space-y-1 sm:block">
                        {dayNotes
                          .slice(0, 2)
                          .map(
                            (note) => (
                              <div
                                key={
                                  note.id
                                }
                                className={`truncate rounded px-1.5 py-1 text-[9px] font-medium ${
                                  noteTypeClasses(
                                    note.note_type
                                  ).badge
                                }`}
                              >
                                {note.title ||
                                  noteTypeLabel(
                                    note.note_type
                                  )}
                              </div>
                            )
                          )}
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Scheduled class
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Class note
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Reminder
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet-600" />
                Assessment
              </span>
            </div>
          </div>

          <aside className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Upcoming
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {resolvedTerm} reminders
                  and assessments.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(
                    true
                  );
                  openNewNote();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white transition hover:bg-slate-800"
                aria-label="Add planner note"
              >
                <PlusIcon />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {upcomingItems.length >
              0 ? (
                upcomingItems.map(
                  (note) => (
                    <button
                      type="button"
                      key={note.id}
                      onClick={() => {
                        setSelectedDate(
                          note.note_date
                        );

                        setDrawerOpen(
                          true
                        );

                        setEditorOpen(
                          false
                        );
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition hover:bg-slate-50 ${
                        noteTypeClasses(
                          note.note_type
                        ).border
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            noteTypeClasses(
                              note.note_type
                            ).dot
                          }`}
                        />

                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-400">
                            {new Intl.DateTimeFormat(
                              "en-US",
                              {
                                month:
                                  "short",
                                day: "numeric",
                              }
                            ).format(
                              fromDateKey(
                                note.note_date
                              )
                            )}
                          </div>

                          <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                            {note.title ||
                              noteTypeLabel(
                                note.note_type
                              )}
                          </div>

                          {note.course_code && (
                            <div className="mt-1 text-xs font-medium text-blue-700">
                              {
                                note.course_code
                              }
                              {note.section
                                ? ` · Sec ${note.section}`
                                : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                )
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-8 text-center">
                  <div className="text-sm font-medium text-slate-700">
                    Nothing upcoming
                  </div>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    No active reminder or
                    assessment is recorded
                    for this month.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setDrawerOpen(true);
                setEditorOpen(false);
              }}
              className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open selected day
            </button>
          </aside>
        </div>
      </section>

      {drawerOpen && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close planner"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={() => {
              setDrawerOpen(false);
              setEditorOpen(false);
            }}
          />

          <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
                  {resolvedTerm}
                </div>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {fullDateTitle(
                    selectedDate
                  )}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(
                    false
                  );
                  setEditorOpen(
                    false
                  );
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <XIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {selectedClasses.length >
                0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Scheduled Classes
                  </h3>

                  <div className="mt-3 space-y-3">
                    {selectedClasses.map(
                      (
                        row,
                        index
                      ) => (
                        <div
                          key={`${combinedCourseCodes(row.courseCode, row.coOfferedCourseCodes)}-${row.section}-${row.timeText}-${index}`}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-slate-950">
                                {
                                  row.courseCode
                                }{" "}
                                · Sec{" "}
                                {
                                  row.section
                                }
                              </div>

                              <div className="mt-1 text-sm text-slate-600">
                                {
                                  row.courseTitle
                                }
                              </div>

                              <div className="mt-2 text-xs text-slate-500">
                                {
                                  row.timeText
                                }{" "}
                                ·{" "}
                                {
                                  row.roomText
                                }
                              </div>
                            </div>

                            {row.offeredCourseId && (
                              <button
                                type="button"
                                onClick={() =>
                                  openNewNote(
                                    row.offeredCourseId ||
                                      undefined
                                  )
                                }
                                className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100"
                              >
                                + Class note
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div
                className={
                  selectedClasses.length >
                  0
                    ? "mt-7"
                    : ""
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Planner Items
                  </h3>

                  <button
                    type="button"
                    onClick={() =>
                      openNewNote()
                    }
                    disabled={
                      !academicTermId
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlusIcon />
                    Add Note
                  </button>
                </div>

                {!academicTermId && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {resolvedTerm} is not
                    currently available as
                    an academic term.
                    Routine viewing remains
                    available if a schedule
                    exists, but new planner
                    notes cannot be saved.
                  </div>
                )}

                <div className="mt-3 space-y-3">
                  {selectedNotes.length >
                  0 ? (
                    selectedNotes.map(
                      (note) => {
                        const style =
                          noteTypeClasses(
                            note.note_type
                          );

                        return (
                          <article
                            key={
                              note.id
                            }
                            className={`rounded-2xl border p-4 ${style.border}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}
                                  >
                                    {noteTypeLabel(
                                      note.note_type
                                    )}
                                  </span>

                                  {note.is_completed && (
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                      Completed
                                    </span>
                                  )}
                                </div>

                                <h4
                                  className={`mt-3 font-semibold ${
                                    note.is_completed
                                      ? "text-slate-400 line-through"
                                      : "text-slate-950"
                                  }`}
                                >
                                  {note.title ||
                                    noteTypeLabel(
                                      note.note_type
                                    )}
                                </h4>

                                {note.course_code && (
                                  <div className="mt-1 text-xs font-semibold text-blue-700">
                                    {
                                      note.course_code
                                    }
                                    {note.section
                                      ? ` · Sec ${note.section}`
                                      : ""}
                                  </div>
                                )}

                                <p
                                  className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${
                                    note.is_completed
                                      ? "text-slate-400"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {
                                    note.note_text
                                  }
                                </p>
                              </div>

                              <div className="flex shrink-0 gap-1">
                                {(note.note_type ===
                                  "REMINDER" ||
                                  note.note_type ===
                                    "ASSESSMENT") && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleComplete(
                                        note
                                      )
                                    }
                                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                      note.is_completed
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    <CheckIcon />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditNote(
                                      note
                                    )
                                  }
                                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteNote(
                                      note
                                    )
                                  }
                                  className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      }
                    )
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-5 py-10 text-center">
                      <div className="text-sm font-medium text-slate-700">
                        No planner items
                        for this day
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Record what was
                        taught or prepare
                        the next activity.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {editorOpen && (
                <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-950">
                      {form.id
                        ? "Edit Planner Item"
                        : "Add Planner Item"}
                    </h3>

                    <button
                      type="button"
                      onClick={() =>
                        setEditorOpen(
                          false
                        )
                      }
                      className="text-xs font-semibold text-slate-500"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-semibold text-slate-600">
                        Date
                      </span>

                      <input
                        type="date"
                        value={
                          form.noteDate
                        }
                        onChange={(
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,
                              noteDate:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      />
                    </label>

                    <label>
                      <span className="text-xs font-semibold text-slate-600">
                        Type
                      </span>

                      <select
                        value={
                          form.noteType
                        }
                        onChange={(
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,
                              noteType:
                                event
                                  .target
                                  .value as PlannerNoteType,
                            })
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      >
                        {NOTE_TYPES.map(
                          (type) => (
                            <option
                              key={
                                type.value
                              }
                              value={
                                type.value
                              }
                            >
                              {
                                type.label
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <span className="text-xs font-semibold text-slate-600">
                      Course
                    </span>

                    <select
                      value={
                        form.offeredCourseId
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            offeredCourseId:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="">
                        General / no
                        specific course
                      </option>

                      {courseOptions.map(
                        (course) => (
                          <option
                            key={
                              course.offeredCourseId
                            }
                            value={
                              course.offeredCourseId
                            }
                          >
                            {
                              course.displayCourseCode
                            }{" "}
                            · Sec{" "}
                            {
                              course.section
                            }{" "}
                            —{" "}
                            {
                              course.courseTitle
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  {previousClassNote && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-white p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                        Previous class
                        note
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {
                          previousClassNote.note_date
                        }
                      </div>

                      <div className="mt-2 text-sm leading-5 text-slate-700">
                        {
                          previousClassNote.note_text
                        }
                      </div>
                    </div>
                  )}

                  <label className="mt-4 block">
                    <span className="text-xs font-semibold text-slate-600">
                      Title
                    </span>

                    <input
                      type="text"
                      maxLength={200}
                      value={form.title}
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            title:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>

                  <label className="mt-4 block">
                    <span className="text-xs font-semibold text-slate-600">
                      Note
                    </span>

                    <textarea
                      rows={5}
                      value={
                        form.noteText
                      }
                      onChange={(
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            noteText:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="What was taught, what remains, or what should be remembered for the next class?"
                      className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    />
                  </label>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditorOpen(
                          false
                        )
                      }
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={saveNote}
                      disabled={
                        saving ||
                        !form.noteText.trim()
                      }
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {saving
                        ? "Saving..."
                        : form.id
                          ? "Save Changes"
                          : "Save Note"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

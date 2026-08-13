"use client";

import { useEffect, useMemo, useState } from "react";


type CourseSchedule = {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
};

type LinkedSecondaryCourse = {
  id: number;
  courseCode: string;
  courseTitle: string;
  section: string;
  programCode: string;
  batchCodes: string[];
};

type AvailableCourse = {
  id: number;
  section: string;
  offeringStatus: string;
  programCode: string;
  programName: string;
  courseCode: string;
  courseTitle: string;
  credit: number;
  batchCodes: string[];
  teacherCodes?: string[];
  teacherText?: string[];
  schedule: CourseSchedule[];
  linkedSecondaryCourses: LinkedSecondaryCourse[];
  selectionState:
    | "FREE"
    | "YOU_BUFFER"
    | "YOU_FINAL"
    | "YOU_PREASSIGNED"
    | "TAKEN_FINAL"
    | "BUFFERED_BY_OTHERS";
  isPreassigned?: boolean;
  isPreassignedToCurrentFaculty?: boolean;
  isPreassignedToAnotherFaculty?: boolean;
  locked?: boolean;
  lockReason?: string;
  bufferedByOthersCount?: number;
};

type SelectionRow = {
  id: number;
  offeredCourseId: number;
  priorityOrder: number | null;
  status: string;
  selectedAt: string | null;
  confirmedAt: string | null;
  course: AvailableCourse;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  teacher?: {
    id: number;
    teacher_code: string;
    full_name: string;
    designation: string | null;
    department_code: string | null;
    seniority_level: number | null;
  };
  term?: {
    id: number;
    name: string;
  };
  windowStatus?: string;
  activeTurn?: {
    teacherId: number;
    teacherCode: string;
    fullName: string;
    seniorityLevel: number | null;
  } | null;
  canEdit?: boolean;
  editMessage?: string;
  hasFinalized?: boolean;
  creditPolicy?: {
    level: number;
    minCredits: number | null;
    maxCredits: number | null;
  } | null;
  preassignedCredits?: number;
  chosenCredits?: number;
  combinedCurrentCredits?: number;
  currentSelectedCredits?: number;
  remainingSelectableCredits?: number | null;
  sessionRemainingMinutes?: number;
  availableCourses?: AvailableCourse[];
  selections?: SelectionRow[];
};

function statusBadgeClasses(status: string) {
  if (status === "OPEN") return "bg-green-100 text-green-700";
  if (status === "CLOSED") return "bg-red-100 text-red-700";
  if (status === "FINAL_LOCKED") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function schedulesOverlap(a: CourseSchedule[], b: CourseSchedule[]) {
  if (!a.length || !b.length) return false;

  return a.some((slotA) =>
    b.some((slotB) => {
      if (slotA.dayOfWeek.toUpperCase() !== slotB.dayOfWeek.toUpperCase()) {
        return false;
      }

      const aStart = timeToMinutes(slotA.startTime);
      const aEnd = timeToMinutes(slotA.endTime);
      const bStart = timeToMinutes(slotB.startTime);
      const bEnd = timeToMinutes(slotB.endTime);

      return aStart < bEnd && bStart < aEnd;
    })
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

export default function FacultyCourseChoicePageClient() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [activeTermName, setActiveTermName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [designation, setDesignation] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState<number | null>(null);

  const [windowStatus, setWindowStatus] = useState("CLOSED");
  const [canEdit, setCanEdit] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [hasFinalized, setHasFinalized] = useState(false);
  const [sessionRemainingMinutes, setSessionRemainingMinutes] = useState(0);
  const [activeTurnText, setActiveTurnText] = useState("-");

  const [creditPolicy, setCreditPolicy] = useState<{
    level: number;
    minCredits: number | null;
    maxCredits: number | null;
  } | null>(null);

  const [courseSearch, setCourseSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("ALL");

  const [preassignedCredits, setPreassignedCredits] = useState(0);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);

  async function loadPage() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/faculty/course-choices/options", {
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load faculty choice page.");
      }

      setActiveTermName(json.term?.name || "");
      setTeacherName(json.teacher?.full_name || "");
      setTeacherCode(json.teacher?.teacher_code || "");
      setDesignation(json.teacher?.designation || "");
      setDepartmentCode(json.teacher?.department_code || "");
      setSeniorityLevel(json.teacher?.seniority_level ?? null);

      setWindowStatus(json.windowStatus || "CLOSED");
      setCanEdit(Boolean(json.canEdit));
      setEditMessage(json.editMessage || "");
      setHasFinalized(Boolean(json.hasFinalized));
      setCreditPolicy(json.creditPolicy || null);
      setSessionRemainingMinutes(Number(json.sessionRemainingMinutes || 0));

      setActiveTurnText(
        json.activeTurn
          ? `${json.activeTurn.teacherCode} - ${json.activeTurn.fullName}`
          : "-"
      );

      setPreassignedCredits(Number(json.preassignedCredits || 0));

      const rows = json.availableCourses || [];
      setAvailableCourses(rows);

      const selected = (json.selections || [])
        .sort((a, b) => (a.priorityOrder || 9999) - (b.priorityOrder || 9999))
        .map((row) => row.offeredCourseId);

      setSelectedCourseIds(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty choice page.");
      setAvailableCourses([]);
      setSelectedCourseIds([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  const courseMap = useMemo(() => {
    return new Map(availableCourses.map((course) => [course.id, course]));
  }, [availableCourses]);

  const selectedCourses = useMemo(() => {
    return selectedCourseIds
      .map((id) => courseMap.get(id))
      .filter(Boolean) as AvailableCourse[];
  }, [selectedCourseIds, courseMap]);

  const liveBufferCredits = useMemo(() => {
    return selectedCourses.reduce((sum, course) => sum + Number(course.credit || 0), 0);
  }, [selectedCourses]);

  const liveTotalCredits = useMemo(() => {
    return Number((preassignedCredits + liveBufferCredits).toFixed(2));
  }, [preassignedCredits, liveBufferCredits]);

  const liveRemainingCapacity = useMemo(() => {
    const maxCredits = creditPolicy?.maxCredits;
    if (maxCredits === null || maxCredits === undefined) return null;
    return Number(Math.max(0, maxCredits - liveTotalCredits).toFixed(2));
  }, [creditPolicy, liveTotalCredits]);

  function hasConflictWithCurrentBuffer(course: AvailableCourse) {
    return selectedCourses.some((selected) =>
      schedulesOverlap(course.schedule, selected.schedule)
    );
  }

  function addCourse(courseId: number) {
    if (!canEdit || hasFinalized) return;
    if (selectedCourseIds.includes(courseId)) return;

    const course = courseMap.get(courseId);
    if (!course) return;

    if (course.locked) {
      setError(course.lockReason || "This course cannot be selected.");
      return;
    }

    if (hasConflictWithCurrentBuffer(course)) {
      setError(
        `A similar time-slot course is already in your buffer. You cannot add ${course.courseCode} Sec-${course.section}.`
      );
      return;
    }

    const maxCredits = creditPolicy?.maxCredits;
    if (
      maxCredits !== null &&
      maxCredits !== undefined &&
      Number((liveTotalCredits + Number(course.credit || 0)).toFixed(2)) > maxCredits
    ) {
      setError(
        `Adding ${course.courseCode} exceeds your maximum allowed load of ${maxCredits} credits.`
      );
      return;
    }

    setError("");
    setSelectedCourseIds((prev) => [...prev, courseId]);
  }

  function removeCourse(courseId: number) {
    if (!canEdit || hasFinalized) return;
    setError("");
    setSelectedCourseIds((prev) => prev.filter((id) => id !== courseId));
  }

  function moveUp(index: number) {
    if (!canEdit || hasFinalized || index <= 0) return;

    setSelectedCourseIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    if (!canEdit || hasFinalized || index >= selectedCourseIds.length - 1) return;

    setSelectedCourseIds((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  async function saveBuffer() {
    if (!activeTermName) {
      setError("No active semester is currently opened by coordinator/admin.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/faculty/course-choices/save-buffer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termName: activeTermName,
          offeredCourseIds: selectedCourseIds,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save choice buffer.");
      }

      await loadPage();
      setMessage("Choice buffer saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save choice buffer.");
    } finally {
      setSaving(false);
    }
  }

  async function finalizeChoices() {
    if (!activeTermName) {
      setError("No active semester is currently opened by coordinator/admin.");
      return;
    }

    const acknowledgementMessage = [
      `Thank you for finalizing your course choices for ${activeTermName}.`,
      "",
      "Please confirm that you understand and accept the following:",
      "",
      "Your submitted choices represent your preferred teaching schedule for the current semester. Final course assignments, class schedules, rooms, sections, co-offering arrangements, and routine adjustments remain subject to the academic and administrative requirements of the Department.",
      "",
      "The Department Coordinator and Chairman reserve the right to make necessary adjustments when required for effective academic planning, conflict resolution, workload balancing, co-offering management, room availability, student needs, and other departmental academic or administrative considerations.",
      "",
      "By confirming this submission, you acknowledge that you will undertake the classes and academic responsibilities assigned to you according to the final offering and routine officially approved and communicated by the Department.",
      "",
      "After final submission, you will not be able to edit your choices unless the Coordinator or authorized administrator reopens your submission.",
      "",
      "Do you understand and accept these conditions and wish to finalize your submission?"
    ].join("\n");

    const ok = window.confirm(
      acknowledgementMessage
    );

    if (!ok) return;

    setFinalizing(true);
    setError("");
    setMessage("");

    try {
      const saveRes = await fetch("/api/faculty/course-choices/save-buffer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termName: activeTermName,
          offeredCourseIds: selectedCourseIds,
        }),
      });

      const saveJson = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveJson.error || "Failed to save before final submit.");
      }

      const res = await fetch("/api/faculty/course-choices/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ termName: activeTermName }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to finalize faculty choices.");
      }

      await loadPage();
      setMessage(
        `Your course choices for ${activeTermName} have been finalized successfully. The Department will complete the final academic offering, workload balancing, co-offering arrangements, and routine preparation before the approved schedule is communicated.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finalize faculty choices.");
    } finally {
      setFinalizing(false);
    }
  }

  const poolCourses = useMemo(() => {
    return availableCourses.filter((course) => !selectedCourseIds.includes(course.id));
  }, [availableCourses, selectedCourseIds]);

  const programFilterOptions = useMemo(() => {
    return Array.from(
      new Set(
        availableCourses
          .map((course) => course.programCode)
          .filter(Boolean)
      )
    ).sort();
  }, [availableCourses]);

  const visiblePoolCourses = useMemo(() => {
    const search = courseSearch.trim().toUpperCase();

    return poolCourses.filter((course) => {
      if (
        programFilter !== "ALL" &&
        course.programCode !== programFilter
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      const linkedText = course.linkedSecondaryCourses
        .map(
          (secondary) =>
            `${secondary.programCode} ${secondary.courseCode} ${secondary.courseTitle} ${secondary.batchCodes.join(" ")}`
        )
        .join(" ");

      const searchableText = [
        course.programCode,
        course.programName,
        course.courseCode,
        course.courseTitle,
        course.section,
        course.batchCodes.join(" "),
        linkedText,
      ]
        .join(" ")
        .toUpperCase();

      return searchableText.includes(search);
    });
  }, [
    poolCourses,
    courseSearch,
    programFilter,
  ]);

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Faculty Course Choice</h1>
            <p className="text-sm text-slate-600">
              Current Semester:{" "}
              <span className="font-semibold text-slate-900">
                {activeTermName || "Not opened by coordinator/admin yet"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadPage}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>

            <a
              href="/faculty/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Dashboard
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoBox label="Faculty" value={`${teacherCode || "-"} - ${teacherName || "-"}`} />
            <InfoBox label="Designation" value={designation || "-"} />
            <InfoBox label="Department" value={departmentCode || "-"} />
            <InfoBox
              label="Seniority Position"
              value={
                seniorityLevel
                  ? `Seniority ${seniorityLevel} (lower number = higher priority)`
                  : "-"
              }
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Choice Window</div>
              <div className="mt-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses(
                    windowStatus
                  )}`}
                >
                  {windowStatus}
                </span>
              </div>
            </div>

            <InfoBox label="Current Active Faculty" value={activeTurnText} />
            <InfoBox label="Your Permission" value={canEdit ? "Active editor" : "View only"} />
            <InfoBox label="Session Remaining" value={`${sessionRemainingMinutes} minute(s)`} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoBox
              label="Credit Rule"
              value={`Min ${creditPolicy?.minCredits ?? "-"} | Max ${
                creditPolicy?.maxCredits ?? "-"
              }`}
            />
            <InfoBox label="Coordinator Pre-assigned Credits" value={String(preassignedCredits)} />
            <InfoBox label="Current Buffer Credits" value={String(liveBufferCredits)} />
            <InfoBox label="Total Current Load" value={String(liveTotalCredits)} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoBox
              label="Remaining Choice Capacity"
              value={liveRemainingCapacity === null ? "-" : String(liveRemainingCapacity)}
            />
            <InfoBox label="Available Offered Sections" value={`${poolCourses.length} section(s)`} />
            <InfoBox label="Selected Buffer Items" value={`${selectedCourseIds.length} section(s)`} />
            <InfoBox label="Final Submission Status" value={hasFinalized ? "Final submitted" : "Not finalized"} />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {!canEdit && editMessage ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {editMessage}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Visible Offered Pool
              </h2>
              <span className="text-sm text-slate-500">
                {poolCourses.length} section(s)
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Find Course
                </label>

                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Search course code, title, batch or co-offered course..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Program
                </label>

                <select
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="ALL">
                    All Programs
                  </option>

                  {programFilterOptions.map((program) => (
                    <option
                      key={program}
                      value={program}
                    >
                      {program}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-500">
                Showing {visiblePoolCourses.length} of {poolCourses.length} available teaching section(s)
              </span>

              {(courseSearch || programFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setCourseSearch("");
                    setProgramFilter("ALL");
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {visiblePoolCourses.map((course) => {
                const slotConflictNow = hasConflictWithCurrentBuffer(course);
                const addDisabled =
                  !canEdit ||
                  hasFinalized ||
                  slotConflictNow ||
                  Boolean(course.locked);

                return (
                  <div key={course.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {course.courseCode} - {course.courseTitle}
                        </div>

                        <div className="text-sm text-slate-600">
                          {course.programCode} | Sec-{course.section} | {course.credit} credits
                        </div>

                        <div className="text-sm text-slate-500">
                          Batches: {course.batchCodes.join(", ") || "-"}
                        </div>

                        <div className="text-sm text-slate-500">
                          Offering Status: {course.offeringStatus}
                        </div>

                        {course.teacherCodes && course.teacherCodes.length > 0 ? (
                          <div className="text-sm text-slate-500">
                            Teachers: {course.teacherCodes.join(", ")}
                          </div>
                        ) : null}

                        {course.selectionState === "YOU_PREASSIGNED" ? (
                          <div className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            Already preassigned to you
                          </div>
                        ) : null}

                        {course.isPreassignedToAnotherFaculty ? (
                          <div className="mt-2 inline-block rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                            Preassigned to another faculty
                          </div>
                        ) : null}

                        {course.selectionState === "BUFFERED_BY_OTHERS" ? (
                          <div className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            Buffered by {course.bufferedByOthersCount || 0} other faculty member(s)
                          </div>
                        ) : null}

                        {slotConflictNow ? (
                          <div className="mt-2 inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            Similar slot course already in your buffer
                          </div>
                        ) : null}

                        {course.locked && course.lockReason ? (
                          <div className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {course.lockReason}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => addCourse(course.id)}
                        disabled={addDisabled}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>

                    {course.schedule.length > 0 && (
                      <div className="mt-3 text-sm text-slate-600">
                        Schedule:{" "}
                        {course.schedule
                          .map(
                            (slot) =>
                              `${slot.dayOfWeek} ${slot.startTime}-${slot.endTime} | ${slot.roomCode}`
                          )
                          .join(" || ")}
                      </div>
                    )}

                    {course.linkedSecondaryCourses.length > 0 && (
                      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
                            CO-OFFERED TEACHING GROUP
                          </span>

                          <span className="text-xs font-medium text-violet-800">
                            One shared faculty / schedule / room
                          </span>
                        </div>

                        <div className="mt-3 text-sm font-semibold text-slate-900">
                          Primary Teaching Course
                        </div>

                        <div className="mt-1 text-sm text-slate-700">
                          {course.programCode} {course.courseCode} - {course.courseTitle}
                        </div>

                        <div className="mt-3 text-sm font-semibold text-violet-900">
                          Co-offered With
                        </div>

                        <div className="mt-2 space-y-2">
                          {course.linkedSecondaryCourses.map((secondary) => (
                            <div
                              key={secondary.id}
                              className="rounded-lg border border-violet-200 bg-white px-3 py-2"
                            >
                              <div className="font-semibold text-slate-900">
                                {secondary.programCode} {secondary.courseCode} - {secondary.courseTitle}
                              </div>

                              <div className="mt-1 text-xs text-slate-600">
                                Sec-{secondary.section} | Batches:{" "}
                                {secondary.batchCodes.join(", ") || "-"}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 text-xs leading-5 text-violet-800">
                          Selecting this item selects the shared teaching event once.
                          The linked courses remain academically separate for their own programs and batches.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {visiblePoolCourses.length === 0 && !loading && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                  {poolCourses.length === 0
                    ? "No faculty-visible sections found for the current semester."
                    : "No offered course matches the current search/filter."}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Your Priority Buffer
              </h2>
              <span className="text-sm text-slate-500">
                {selectedCourseIds.length} selected
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {selectedCourses.map((course, index) => (
                <div key={course.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        #{index + 1} - {course.courseCode} - {course.courseTitle}
                      </div>
                      <div className="text-sm text-slate-600">
                        {course.programCode} | Sec-{course.section} | {course.credit} credits
                      </div>

                      {course.linkedSecondaryCourses.length > 0 && (
                        <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                          <div className="text-xs font-bold uppercase tracking-wide text-violet-700">
                            Co-offered Teaching Group
                          </div>

                          <div className="mt-1 text-xs text-violet-900">
                            With:{" "}
                            {course.linkedSecondaryCourses
                              .map(
                                (secondary) =>
                                  `${secondary.programCode} ${secondary.courseCode} (Batch ${secondary.batchCodes.join(", ") || "-"})`
                              )
                              .join(" ; ")}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={!canEdit || hasFinalized || index === 0}
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        Up
                      </button>

                      <button
                        onClick={() => moveDown(index)}
                        disabled={!canEdit || hasFinalized || index === selectedCourseIds.length - 1}
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        Down
                      </button>

                      <button
                        onClick={() => removeCourse(course.id)}
                        disabled={!canEdit || hasFinalized}
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {selectedCourses.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                  No courses selected yet.
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={saveBuffer}
                disabled={!canEdit || hasFinalized || saving}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Buffer"}
              </button>

              <button
                onClick={finalizeChoices}
                disabled={!canEdit || hasFinalized || finalizing}
                className="rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {finalizing ? "Finalizing..." : "Final Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

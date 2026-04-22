"use client";

import { useEffect, useMemo, useState } from "react";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

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
  teacherCodes: string[];
  schedule: CourseSchedule[];
  linkedSecondaryCourses: LinkedSecondaryCourse[];
  selectionState:
    | "FREE"
    | "YOU_BUFFER"
    | "YOU_FINAL"
    | "TAKEN_FINAL"
    | "BUFFERED_BY_OTHERS";
  finalizedByOtherFaculty: {
    teacherId: number;
    teacherCode: string;
    teacherName: string;
  } | null;
  bufferedByOtherFacultyCount: number;
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
  activeSeniorityLevel?: number | null;
  activeTeacherId?: number | null;
  canEdit?: boolean;
  editMessage?: string;
  hasFinalized?: boolean;
  creditPolicy?: {
    level: number;
    minCredits: number | null;
    maxCredits: number | null;
  } | null;
  currentSelectedCredits?: number;
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

export default function FacultyCourseChoicePageClient() {
  const { terms, termName, setTermName, loadingTerms, termError } = useAcademicTerms();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [teacherName, setTeacherName] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [designation, setDesignation] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState<number | null>(null);

  const [windowStatus, setWindowStatus] = useState("CLOSED");
  const [activeSeniorityLevel, setActiveSeniorityLevel] = useState<number | null>(null);
  const [activeTeacherId, setActiveTeacherId] = useState<number | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [hasFinalized, setHasFinalized] = useState(false);
  const [sessionRemainingMinutes, setSessionRemainingMinutes] = useState(0);

  const [creditPolicy, setCreditPolicy] = useState<{
    level: number;
    minCredits: number | null;
    maxCredits: number | null;
  } | null>(null);

  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);

  async function loadPage() {
    if (!termName) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/faculty/course-choices/options?termName=${encodeURIComponent(termName)}`,
        { cache: "no-store" }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load faculty choice page.");
      }

      setTeacherName(json.teacher?.full_name || "");
      setTeacherCode(json.teacher?.teacher_code || "");
      setDesignation(json.teacher?.designation || "");
      setDepartmentCode(json.teacher?.department_code || "");
      setSeniorityLevel(json.teacher?.seniority_level ?? null);

      setWindowStatus(json.windowStatus || "CLOSED");
      setActiveSeniorityLevel(json.activeSeniorityLevel ?? null);
      setActiveTeacherId(json.activeTeacherId ?? null);
      setCanEdit(Boolean(json.canEdit));
      setEditMessage(json.editMessage || "");
      setHasFinalized(Boolean(json.hasFinalized));
      setCreditPolicy(json.creditPolicy || null);
      setSessionRemainingMinutes(Number(json.sessionRemainingMinutes || 0));

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
    if (termName) {
      loadPage();
    }
  }, [termName]);

  const selectedCourses = useMemo(() => {
    const map = new Map(availableCourses.map((course) => [course.id, course]));
    return selectedCourseIds.map((id) => map.get(id)).filter(Boolean) as AvailableCourse[];
  }, [availableCourses, selectedCourseIds]);

  const liveSelectedCredits = useMemo(() => {
    return selectedCourses.reduce((sum, course) => sum + Number(course.credit || 0), 0);
  }, [selectedCourses]);

  function addCourse(courseId: number) {
    if (!canEdit || hasFinalized) return;
    if (selectedCourseIds.includes(courseId)) return;
    setSelectedCourseIds((prev) => [...prev, courseId]);
  }

  function removeCourse(courseId: number) {
    if (!canEdit || hasFinalized) return;
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
    if (!termName) {
      setError("Please select a term.");
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
          termName,
          offeredCourseIds: selectedCourseIds,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save choice buffer.");
      }

      setMessage("Choice buffer saved successfully.");
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save choice buffer.");
    } finally {
      setSaving(false);
    }
  }

  async function finalizeChoices() {
    if (!termName) {
      setError("Please select a term.");
      return;
    }

    const ok = window.confirm(
      "Final submit will lock your choices for this term. Do you want to continue?"
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
          termName,
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
        body: JSON.stringify({ termName }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to finalize faculty choices.");
      }

      setMessage("Final choice submission completed successfully.");
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finalize faculty choices.");
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Faculty Course Choice</h1>
              <p className="mt-1 text-sm text-slate-600">
                All faculty may view the open offered pool. Only the active turn may edit and
                finalize choices.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/faculty/dashboard"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to Dashboard
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-sm text-slate-500">Faculty</div>
              <div className="mt-1 font-semibold text-slate-900">
                {teacherCode} — {teacherName}
              </div>
              <div className="text-sm text-slate-600">{designation || "-"}</div>
            </div>

            <div>
              <div className="text-sm text-slate-500">Department / Level</div>
              <div className="mt-1 font-semibold text-slate-900">
                {departmentCode || "-"} | Level {seniorityLevel ?? "-"}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-500">Window Status</div>
              <div className="mt-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses(windowStatus)}`}
                >
                  {windowStatus}
                </span>
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-500">Session Remaining</div>
              <div className="mt-1 font-semibold text-slate-900">
                {sessionRemainingMinutes} minute(s)
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Active Seniority Phase</div>
              <div className="mt-1 font-semibold text-slate-900">
                {activeSeniorityLevel ? `Level ${activeSeniorityLevel}` : "All Levels"}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Active Faculty Turn</div>
              <div className="mt-1 font-semibold text-slate-900">
                {activeTeacherId ? `Teacher ID ${activeTeacherId}` : "Not fixed"}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Credit Rule</div>
              <div className="mt-1 font-semibold text-slate-900">
                Min {creditPolicy?.minCredits ?? "-"} | Max {creditPolicy?.maxCredits ?? "-"}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Selected Credits</div>
              <div className="mt-1 font-semibold text-slate-900">{liveSelectedCredits}</div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Academic Term
            </label>
            <select
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
              className="w-full max-w-sm rounded-xl border px-4 py-3"
              disabled={loadingTerms}
            >
              <option value="">{loadingTerms ? "Loading terms..." : "Select Academic Term"}</option>
              {terms.map((term) => (
                <option key={term.name} value={term.name}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(error || termError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || termError}
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
              <h2 className="text-lg font-semibold text-slate-900">Visible Offered Pool</h2>
              <span className="text-sm text-slate-500">{availableCourses.length} section(s)</span>
            </div>

            <div className="mt-4 space-y-3">
              {availableCourses.map((course) => {
                const selected = selectedCourseIds.includes(course.id);

                return (
                  <div key={course.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {course.courseCode} — {course.courseTitle}
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

                        {course.selectionState === "YOU_BUFFER" ? (
                          <div className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            Already in your buffer
                          </div>
                        ) : null}

                        {course.selectionState === "YOU_FINAL" ? (
                          <div className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            Already finalized by you
                          </div>
                        ) : null}

                        {course.selectionState === "BUFFERED_BY_OTHERS" ? (
                          <div className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            Buffered by {course.bufferedByOtherFacultyCount} other faculty
                            member(s)
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          selected ? removeCourse(course.id) : addCourse(course.id)
                        }
                        disabled={!canEdit || hasFinalized}
                        className={`rounded-xl px-4 py-2 text-sm font-medium ${
                          selected
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        } disabled:opacity-50`}
                      >
                        {selected ? "Remove" : "Add"}
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
                      <div className="mt-3 text-sm text-slate-600">
                        Linked Co-offered:{" "}
                        {course.linkedSecondaryCourses
                          .map(
                            (x) => `${x.programCode} ${x.courseCode} Sec-${x.section}`
                          )
                          .join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}

              {availableCourses.length === 0 && !loading && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                  No faculty-visible sections found for the selected term.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your Priority Buffer</h2>
              <span className="text-sm text-slate-500">{selectedCourseIds.length} selected</span>
            </div>

            <div className="mt-4 space-y-3">
              {selectedCourses.map((course, index) => (
                <div key={course.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        #{index + 1} — {course.courseCode} — {course.courseTitle}
                      </div>
                      <div className="text-sm text-slate-600">
                        {course.programCode} | Sec-{course.section} | {course.credit} credits
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={!canEdit || hasFinalized || index === 0}
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={
                          !canEdit || hasFinalized || index === selectedCourseIds.length - 1
                        }
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        ↓
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
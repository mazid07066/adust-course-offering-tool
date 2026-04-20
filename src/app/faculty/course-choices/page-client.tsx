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
  batchCodes: string[];
  teacherCodes: string[];
  schedule: CourseSchedule[];
  linkedSecondaryCourses: LinkedSecondaryCourse[];
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
  };
  term?: {
    id: number;
    name: string;
  };
  windowStatus?: string;
  sessionRemainingMinutes?: number;
  canEdit?: boolean;
  hasFinalized?: boolean;
  availableCourses?: AvailableCourse[];
  selections?: SelectionRow[];
};

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
  const [windowStatus, setWindowStatus] = useState("CLOSED");
  const [sessionRemainingMinutes, setSessionRemainingMinutes] = useState(0);
  const [canEdit, setCanEdit] = useState(false);
  const [hasFinalized, setHasFinalized] = useState(false);

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
        {
          cache: "no-store",
        }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load faculty choices.");
      }

      setTeacherName(json.teacher?.full_name || "");
      setTeacherCode(json.teacher?.teacher_code || "");
      setDesignation(json.teacher?.designation || "");
      setWindowStatus(json.windowStatus || "CLOSED");
      setSessionRemainingMinutes(json.sessionRemainingMinutes || 0);
      setCanEdit(Boolean(json.canEdit));
      setHasFinalized(Boolean(json.hasFinalized));
      setAvailableCourses(json.availableCourses || []);
      setSelectedCourseIds(
        (json.selections || [])
          .sort((a, b) => (a.priorityOrder || 9999) - (b.priorityOrder || 9999))
          .map((x) => x.offeredCourseId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load faculty choices.");
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
    return selectedCourseIds
      .map((id) => availableCourses.find((course) => course.id === id))
      .filter(Boolean) as AvailableCourse[];
  }, [selectedCourseIds, availableCourses]);

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

      const json: ApiResponse = await res.json();

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

    if (selectedCourseIds.length === 0) {
      setError("Please add at least one preferred course before final submit.");
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

      const saveJson: ApiResponse = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveJson.error || "Failed to save final buffer before submission.");
      }

      const res = await fetch("/api/faculty/course-choices/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termName,
        }),
      });

      const json: ApiResponse = await res.json();

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
                Read offered courses, prepare priority list, save buffer, and submit final choices.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/auth/login"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Login Page
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

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Faculty Info</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <div>
                <span className="font-medium">Faculty:</span> {teacherName || "-"}
              </div>
              <div>
                <span className="font-medium">Code:</span> {teacherCode || "-"}
              </div>
              <div>
                <span className="font-medium">Designation:</span> {designation || "-"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Choice Control</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <div>
                <span className="font-medium">Window Status:</span> {windowStatus}
              </div>
              <div>
                <span className="font-medium">Session Remaining:</span>{" "}
                {sessionRemainingMinutes} minute(s)
              </div>
              <div>
                <span className="font-medium">Edit Permission:</span>{" "}
                {canEdit ? "Editable" : "Read Only"}
              </div>
              <div>
                <span className="font-medium">Final Submit:</span>{" "}
                {hasFinalized ? "Already Submitted" : "Not Submitted"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Select Term</h2>
            <div className="mt-4">
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

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Offered Courses (Read Only)
              </h2>
              <button
                type="button"
                onClick={loadPage}
                disabled={!termName || loading}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="space-y-4">
              {availableCourses.map((course) => {
                const alreadySelected = selectedCourseIds.includes(course.id);

                return (
                  <div
                    key={course.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="text-base font-semibold text-slate-900">
                          {course.courseCode} — {course.courseTitle}
                        </div>
                        <div className="text-sm text-slate-600">
                          Program: {course.programCode}
                        </div>
                        <div className="text-sm text-slate-600">
                          Section: {course.section}
                        </div>
                        <div className="text-sm text-slate-600">
                          Batches: {course.batchCodes.join(", ") || "-"}
                        </div>
                        <div className="text-sm text-slate-600">
                          Assigned Faculty: {course.teacherCodes.join(", ") || "-"}
                        </div>
                        <div className="text-sm text-slate-600">
                          Offering Status: {course.offeringStatus}
                        </div>

                        <div className="pt-2 text-sm text-slate-700">
                          <div className="font-medium">Schedule:</div>
                          {course.schedule.length === 0 ? (
                            <div className="text-slate-500">No slot assigned.</div>
                          ) : (
                            <div className="space-y-1">
                              {course.schedule.map((slot) => (
                                <div key={slot.id}>
                                  {slot.dayOfWeek} {slot.startTime}-{slot.endTime} |{" "}
                                  {slot.roomCode}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {course.linkedSecondaryCourses.length > 0 && (
                          <div className="pt-2 text-sm text-slate-700">
                            <div className="font-medium">Linked Secondary Courses:</div>
                            <div className="space-y-1">
                              {course.linkedSecondaryCourses.map((secondary) => (
                                <div key={secondary.id}>
                                  {secondary.courseCode} — {secondary.courseTitle} | Sec-
                                  {secondary.section} | {secondary.programCode} | Batches:{" "}
                                  {secondary.batchCodes.join(", ") || "-"}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => addCourse(course.id)}
                          disabled={!canEdit || hasFinalized || alreadySelected}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {alreadySelected ? "Added" : "Add to Preference"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {availableCourses.length === 0 && !loading && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No eligible offered course found for the selected term.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                My Preference Buffer
              </h2>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveBuffer}
                  disabled={!canEdit || hasFinalized || saving || !termName}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Draft Buffer"}
                </button>

                <button
                  type="button"
                  onClick={finalizeChoices}
                  disabled={
                    !canEdit ||
                    hasFinalized ||
                    finalizing ||
                    !termName ||
                    selectedCourseIds.length === 0
                  }
                  className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {finalizing ? "Submitting..." : "Final Submit"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {selectedCourses.map((course, index) => (
                <div
                  key={course.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        Priority {index + 1}
                      </div>

                      <div className="text-base font-semibold text-slate-900">
                        {course.courseCode} — {course.courseTitle}
                      </div>
                      <div className="text-sm text-slate-600">
                        Program: {course.programCode}
                      </div>
                      <div className="text-sm text-slate-600">
                        Section: {course.section}
                      </div>
                      <div className="text-sm text-slate-600">
                        Batches: {course.batchCodes.join(", ") || "-"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        disabled={!canEdit || hasFinalized || index === 0}
                        className="rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-white disabled:opacity-60"
                      >
                        Move Up
                      </button>

                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        disabled={
                          !canEdit ||
                          hasFinalized ||
                          index === selectedCourses.length - 1
                        }
                        className="rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-white disabled:opacity-60"
                      >
                        Move Down
                      </button>

                      <button
                        type="button"
                        onClick={() => removeCourse(course.id)}
                        disabled={!canEdit || hasFinalized}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {selectedCourses.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No preference added yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
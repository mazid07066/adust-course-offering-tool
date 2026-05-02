"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type OfferingOption = {
  id: number;
  programCode: string;
  programName: string;
  status: string;
  courseCount: number;
  canEdit: boolean;
  canConfirm: boolean;
};

type SlotRow = {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomId: number;
  roomCode: string;
  roomType: string;
  slotType: string;
};

type TeacherRow = {
  assignmentId: number;
  teacherId: number;
  teacherCode: string;
  fullName: string;
  designation: string;
  assignedCredit: number;
  loadType: string;
};

type CourseRow = {
  offeredCourseId: number;
  primaryOfferedCourseId: number | null;
  editableCourseId: number;
  isSecondary: boolean;
  programCode: string;
  programName: string;
  offeringStatus: string;
  courseCode: string;
  courseTitle: string;
  credit: number;
  courseType: string;
  section: string;
  batchCodes: string[];
  isSlotOptional: boolean;
  slots: SlotRow[];
  teachers: TeacherRow[];
  facultyText: string;
  scheduleText: string;
};

type AvailabilityRoom = {
  id: number;
  roomCode: string;
  roomType: string;
  capacity: number | null;
};

type AvailabilityTeacher = {
  id: number;
  teacherCode: string;
  fullName: string;
  designation: string;
  email: string;
  phone: string;
  seniorityLevel: number | null;
};

type ConflictItem = {
  type: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  conflictWithStartTime: string;
  conflictWithEndTime: string;
  roomCode: string;
  batchCodes: string[];
  teacherCodes: string[];
  first: {
    programCode: string;
    courseCode: string;
    courseTitle: string;
    section: string;
  };
  second: {
    programCode: string;
    courseCode: string;
    courseTitle: string;
    section: string;
  };
};

const DAYS = ["THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "MONDAY"];

const DURATIONS = [
  { value: 60, label: "1 Hour" },
  { value: 90, label: "1.5 Hours" },
  { value: 120, label: "2 Hours" },
  { value: 180, label: "3 Hours" },
];

function addMinutes(startTime: string, minutes: number) {
  const [hh, mm] = startTime.split(":").map(Number);
  const total = hh * 60 + mm + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function durationFromTimes(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max(60, eh * 60 + em - (sh * 60 + sm));
}

export default function ScheduleControlPageClient() {
  const [terms, setTerms] = useState<string[]>([]);
  const [termName, setTermName] = useState("");
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [courses, setCourses] = useState<CourseRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null);
  const [editingSlot, setEditingSlot] = useState<SlotRow | null>(null);

  const [dayOfWeek, setDayOfWeek] = useState("THURSDAY");
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [roomId, setRoomId] = useState("");

  const [availableRooms, setAvailableRooms] = useState<AvailabilityRoom[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<AvailabilityTeacher[]>([]);
  const [teacherId, setTeacherId] = useState("");

  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [saving, setSaving] = useState(false);

  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectedOffering = useMemo(
    () => offerings.find((item) => String(item.id) === offeringId) || null,
    [offerings, offeringId]
  );

  async function loadTerms() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/schedule-control", {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to load terms.");

      setTerms(json.terms || []);

      if (!termName && json.terms?.length) {
        setTermName(json.terms[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load terms.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOfferings(activeTerm = termName) {
    if (!activeTerm) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const qs = new URLSearchParams({ termName: activeTerm });

      const res = await fetch(`/api/admin/schedule-control?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to load offerings.");

      setOfferings(json.offerings || []);

      if (!offeringId && json.offerings?.length) {
        setOfferingId(String(json.offerings[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offerings.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCourses() {
    if (!termName || !offeringId) return;

    setLoadingCourses(true);
    setError("");
    setMessage("");

    try {
      const qs = new URLSearchParams({
        termName,
        offeringId,
      });

      const res = await fetch(`/api/admin/schedule-control?${qs.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to load courses.");

      setOfferings(json.offerings || []);
      setCourses(json.courses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses.");
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }

  async function loadAvailability(course: CourseRow, slot: SlotRow | null) {
    const endTime = addMinutes(startTime, durationMinutes);

    setLoadingAvailability(true);
    setError("");

    try {
      const qs = new URLSearchParams({
        offeredCourseId: String(course.editableCourseId),
        dayOfWeek,
        startTime,
        endTime,
      });

      if (slot?.id) qs.set("slotId", String(slot.id));

      const res = await fetch(
        `/api/admin/schedule-control/availability?${qs.toString()}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load availability.");
      }

      setAvailableRooms(json.rooms || []);
      setAvailableTeachers(json.teachers || []);

      if (json.rooms?.length) {
        const currentRoomStillAvailable = json.rooms.some(
          (room: AvailabilityRoom) => String(room.id) === roomId
        );

        if (!currentRoomStillAvailable) {
          setRoomId(String(json.rooms[0].id));
        }
      } else {
        setRoomId("");
      }

      if (json.teachers?.length) {
        const currentTeacherStillAvailable = json.teachers.some(
          (teacher: AvailabilityTeacher) => String(teacher.id) === teacherId
        );

        if (!currentTeacherStillAvailable) {
          setTeacherId(String(json.teachers[0].id));
        }
      } else {
        setTeacherId("");
      }
    } catch (err) {
      setAvailableRooms([]);
      setAvailableTeachers([]);
      setError(err instanceof Error ? err.message : "Failed to load availability.");
    } finally {
      setLoadingAvailability(false);
    }
  }

  function openEditor(course: CourseRow, slot?: SlotRow) {
    if (course.offeringStatus === "CONFIRMED") {
      setError("This offering is already CONFIRMED. Editing is blocked.");
      return;
    }

    const selectedSlot = slot || course.slots[0] || null;

    setEditingCourse(course);
    setEditingSlot(selectedSlot);
    setDayOfWeek(selectedSlot?.dayOfWeek || "THURSDAY");
    setStartTime(selectedSlot?.startTime || "09:00");
    setDurationMinutes(
      selectedSlot ? durationFromTimes(selectedSlot.startTime, selectedSlot.endTime) : 60
    );
    setRoomId(selectedSlot?.roomId ? String(selectedSlot.roomId) : "");
    setTeacherId(
      course.teachers[0]?.teacherId ? String(course.teachers[0].teacherId) : ""
    );
    setAvailableRooms([]);
    setAvailableTeachers([]);
  }

  function closeEditor() {
    setEditingCourse(null);
    setEditingSlot(null);
    setAvailableRooms([]);
    setAvailableTeachers([]);
    setRoomId("");
    setTeacherId("");
  }

  async function saveSlot() {
    if (!editingCourse) return;

    if (!roomId) {
      setError("Please select an available room.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const endTime = addMinutes(startTime, durationMinutes);

      const res = await fetch("/api/admin/schedule-control/apply", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPSERT_SLOT",
          offeredCourseId: editingCourse.editableCourseId,
          slotId: editingSlot?.id || null,
          dayOfWeek,
          startTime,
          endTime,
          roomId: Number(roomId),
        }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to save slot.");

      setMessage(json.message || "Slot saved.");
      await loadCourses();
      closeEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save slot.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFaculty() {
    if (!editingCourse) return;

    if (!teacherId) {
      setError("Please select an available faculty member.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/schedule-control/apply", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "ASSIGN_FACULTY",
          offeredCourseId: editingCourse.editableCourseId,
          teacherId: Number(teacherId),
        }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to assign faculty.");

      setMessage(json.message || "Faculty updated.");
      await loadCourses();
      closeEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign faculty.");
    } finally {
      setSaving(false);
    }
  }

  async function runConflictCheck() {
    if (!termName || !offeringId) return;

    setCheckingConflicts(true);
    setError("");
    setMessage("");

    try {
      const qs = new URLSearchParams({
        termName,
        offeringId,
      });

      const res = await fetch(`/api/admin/conflicts/run-check?${qs.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to run conflict check.");

      setConflicts(json.conflicts || []);

      if ((json.conflicts || []).length === 0) {
        setMessage("No conflicts found. This offering is ready for confirmation.");
      } else {
        setError(`${json.conflicts.length} conflict(s) found. Please resolve them.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run conflict check.");
    } finally {
      setCheckingConflicts(false);
    }
  }

  async function confirmOffering() {
    if (!offeringId) return;

    const ok = window.confirm(
      "Confirm this offering? After confirmation, slot/faculty edits will be locked."
    );

    if (!ok) return;

    setConfirming(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/schedule-control/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offeringId: Number(offeringId),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const blockers =
          Array.isArray(json.blockers) && json.blockers.length
            ? `\n\nBlockers:\n- ${json.blockers.join("\n- ")}`
            : "";

        throw new Error((json.error || "Failed to confirm offering.") + blockers);
      }

      setMessage(
        `${json.message || "Offering confirmed."} Reports and public schedule can now be checked.`
      );

      await loadOfferings(termName);
      await loadCourses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to confirm offering."
      );
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (termName) {
      setOfferingId("");
      setCourses([]);
      setConflicts([]);
      void loadOfferings(termName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termName]);

  useEffect(() => {
    if (termName && offeringId) {
      setConflicts([]);
      void loadCourses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId]);

  useEffect(() => {
    if (editingCourse) {
      void loadAvailability(editingCourse, editingSlot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCourse?.editableCourseId, editingSlot?.id, dayOfWeek, startTime, durationMinutes]);

  return (
    <AdminLayout title="Final Schedule Control Center">
      <div className="space-y-6">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Final Schedule Control Center
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Review all offered courses, adjust slots, rooms and faculty using
            availability-aware dropdowns, run the final conflict check, then confirm
            the offering for reports and the public schedule.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Academic Term</label>
              <select
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                disabled={loading}
              >
                <option value="">Select Term</option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>

            <div className="xl:col-span-2">
              <label className="mb-2 block text-sm font-medium">Offering</label>
              <select
                value={offeringId}
                onChange={(e) => setOfferingId(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                disabled={!termName || loading}
              >
                <option value="">Select Offering</option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    #{offering.id} | {offering.programCode} | {offering.status} |{" "}
                    {offering.courseCount} courses
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={runConflictCheck}
                disabled={!offeringId || checkingConflicts}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {checkingConflicts ? "Checking..." : "Run Conflict Check"}
              </button>
            </div>
          </div>

          {selectedOffering ? (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              Selected:{" "}
              <span className="font-semibold">
                {selectedOffering.programCode} — {selectedOffering.programName}
              </span>{" "}
              | Status: <span className="font-semibold">{selectedOffering.status}</span>
            </div>
          ) : null}
        </section>

        {message ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {conflicts.length > 0 ? (
          <section className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-red-700">
              Conflict Review ({conflicts.length})
            </h3>

            <div className="mt-4 overflow-x-auto rounded-2xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50">
                  <tr>
                    <th className="border-b px-3 py-3 text-left">Type</th>
                    <th className="border-b px-3 py-3 text-left">Time</th>
                    <th className="border-b px-3 py-3 text-left">Room/Batch/Faculty</th>
                    <th className="border-b px-3 py-3 text-left">First Course</th>
                    <th className="border-b px-3 py-3 text-left">Conflicts With</th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map((conflict, index) => (
                    <tr key={index}>
                      <td className="border-b px-3 py-2 font-semibold">
                        {conflict.type}
                      </td>
                      <td className="border-b px-3 py-2">
                        {conflict.dayOfWeek} {conflict.startTime}-{conflict.endTime}
                      </td>
                      <td className="border-b px-3 py-2">
                        Room: {conflict.roomCode || "-"}
                        <br />
                        Batch: {conflict.batchCodes?.join(", ") || "-"}
                        <br />
                        Faculty: {conflict.teacherCodes?.join(", ") || "-"}
                      </td>
                      <td className="border-b px-3 py-2">
                        {conflict.first.programCode} | {conflict.first.courseCode}{" "}
                        Sec-{conflict.first.section}
                      </td>
                      <td className="border-b px-3 py-2">
                        {conflict.second.programCode} | {conflict.second.courseCode}{" "}
                        Sec-{conflict.second.section}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Course Slot / Room / Faculty Control
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Each course can be edited before confirmation. For co-offered
                secondary rows, edit the primary operational section.
              </p>
            </div>

            <button
              type="button"
              onClick={confirmOffering}
              disabled={!offeringId || confirming || selectedOffering?.status === "CONFIRMED"}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {confirming
                ? "Confirming..."
                : selectedOffering?.status === "CONFIRMED"
                  ? "Already Confirmed"
                  : "Confirm Offering"}
            </button>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Course</th>
                  <th className="border-b px-3 py-3 text-left">Batch</th>
                  <th className="border-b px-3 py-3 text-left">Schedule</th>
                  <th className="border-b px-3 py-3 text-left">Faculty</th>
                  <th className="border-b px-3 py-3 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {courses.map((course) => (
                  <tr key={course.offeredCourseId}>
                    <td className="border-b px-3 py-3 align-top">
                      <div className="font-semibold">
                        {course.courseCode} — Sec {course.section}
                      </div>
                      <div className="text-xs text-slate-600">
                        {course.courseTitle}
                      </div>
                      {course.isSecondary ? (
                        <div className="mt-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                          Secondary co-offered row
                        </div>
                      ) : null}
                    </td>

                    <td className="border-b px-3 py-3 align-top">
                      {course.batchCodes.join(", ") || "-"}
                    </td>

                    <td className="border-b px-3 py-3 align-top">
                      {course.slots.length === 0 ? (
                        course.isSlotOptional ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                            Slot optional
                          </span>
                        ) : (
                          <span className="text-red-600">No slot</span>
                        )
                      ) : (
                        <div className="space-y-2">
                          {course.slots.map((slot) => (
                            <div key={slot.id} className="rounded-xl border p-2">
                              <div>
                                {slot.dayOfWeek} {slot.startTime}-{slot.endTime}
                              </div>
                              <div className="text-xs text-slate-600">
                                {slot.roomCode}
                              </div>
                              {course.offeringStatus !== "CONFIRMED" ? (
                                <button
                                  type="button"
                                  onClick={() => openEditor(course, slot)}
                                  className="mt-2 rounded-lg bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                >
                                  Edit This Slot
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="border-b px-3 py-3 align-top">
                      {course.facultyText}
                    </td>

                    <td className="border-b px-3 py-3 align-top">
                      {course.offeringStatus === "CONFIRMED" ? (
                        <span className="text-xs font-semibold text-slate-500">
                          Locked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditor(course)}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Edit Slot / Room / Faculty
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {!loadingCourses && courses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No courses loaded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {editingCourse ? (
          <section className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Edit: {editingCourse.courseCode} Sec-{editingCourse.section}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {editingCourse.courseTitle}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-5">
              <div>
                <label className="mb-2 block text-sm font-medium">Day</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Duration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  {DURATIONS.map((duration) => (
                    <option key={duration.value} value={duration.value}>
                      {duration.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">End Time</label>
                <input
                  value={addMinutes(startTime, durationMinutes)}
                  readOnly
                  className="w-full rounded-xl border bg-slate-100 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Available Room
                </label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                  disabled={loadingAvailability || availableRooms.length === 0}
                >
                  {availableRooms.length === 0 ? (
                    <option value="">
                      {loadingAvailability ? "Checking..." : "No room available"}
                    </option>
                  ) : (
                    availableRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.roomCode} | {room.roomType}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {loadingAvailability
                ? "Checking room and faculty availability..."
                : `${availableRooms.length} available room(s), ${availableTeachers.length} available faculty member(s) found.`}
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium">
                Available Faculty
              </label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                disabled={loadingAvailability || availableTeachers.length === 0}
              >
                {availableTeachers.length === 0 ? (
                  <option value="">
                    {loadingAvailability ? "Checking..." : "No faculty available"}
                  </option>
                ) : (
                  availableTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.teacherCode} - {teacher.fullName} |{" "}
                      {teacher.designation}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveSlot}
                disabled={saving || !roomId}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : editingSlot ? "Update Slot / Room" : "Add Slot / Room"}
              </button>

              <button
                type="button"
                onClick={saveFaculty}
                disabled={saving || !teacherId}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Update Faculty"}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </AdminLayout>
  );
}
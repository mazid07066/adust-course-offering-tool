"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type ProgramOption = {
  id: number;
  short_name: string;
  name: string;
};

type TermOption = {
  id: number;
  name: string;
};

type RoomOption = {
  id: number;
  room_code: string;
  room_type: string | null;
  capacity: number;
};

type CourseRow = {
  offeredCourseId: number | null;
  programId: number | null;
  programCode: string;
  programName?: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  batchCodes: string[];
  studentCount: number;
  role?: string;
  primaryReference?: string;
  offeringStatus?: string;
};

type SlotRow = {
  startTime: string;
  endTime: string;
};

type SavedSchedule = {
  id: number;
  title: string;
  exam_type: string;
  status: string;
  term_name: string;
  item_count: number;
  created_at: string;
};

type ScheduleItem = {
  id: number;
  course_code: string;
  course_title: string;
  section: string;
  batch_codes: string;
  student_count: number;
  exam_date: string;
  start_time: string;
  end_time: string;
  room_id: number;
  room_code: string;
  room_capacity: number;
  seat_plan_note: string | null;
};

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value: string) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export default function ExamSchedulerPageClient() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);

  const [termName, setTermName] = useState("");
  const [title, setTitle] = useState("Final Examination Schedule");
  const [examType, setExamType] = useState("FINAL");
  const [maxExamsPerBatchPerDay, setMaxExamsPerBatchPerDay] = useState(1);

  const [selectedProgramIds, setSelectedProgramIds] = useState<number[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);

  const [dates, setDates] = useState<string[]>([todayText()]);
  const [slots, setSlots] = useState<SlotRow[]>([
    { startTime: "09:00", endTime: "11:00" },
  ]);

  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [schedules, setSchedules] = useState<SavedSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    examDate: "",
    startTime: "",
    endTime: "",
    roomId: "",
    seatPlanNote: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [unscheduled, setUnscheduled] = useState<any[]>([]);

  const selectedRooms = useMemo(
    () => rooms.filter((room) => selectedRoomIds.includes(room.id)),
    [rooms, selectedRoomIds]
  );

  async function loadOptions() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/exam-scheduler/options", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load options.");
      }

      setPrograms(json.programs || []);
      setTerms(json.terms || []);
      setRooms(json.rooms || []);

      if (!termName && json.terms?.[0]?.name) {
        setTermName(json.terms[0].name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load options.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSchedules() {
    try {
      const res = await fetch("/api/admin/exam-scheduler/schedules", {
        cache: "no-store",
      });

      const json = await res.json();

      if (res.ok) {
        setSchedules(json.schedules || []);
      }
    } catch {
      // keep page usable
    }
  }

  async function loadCourses() {
    setLoading(true);
    setError("");
    setMessage("");
    setUnscheduled([]);

    try {
      const res = await fetch("/api/admin/exam-scheduler/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termName,
          programIds: selectedProgramIds,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load course sections.");
      }

      setCourses(json.rows || []);
      setMessage(`${json.rows?.length || 0} course-section(s) loaded.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load course sections."
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateSchedule() {
    setLoading(true);
    setError("");
    setMessage("");
    setUnscheduled([]);

    try {
      const cleanCourses = courses
        .map((course) => ({
          offeredCourseId: course.offeredCourseId,
          programId: course.programId,
          programCode: course.programCode,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          section: course.section,
          batchCodes: course.batchCodes,
          studentCount: Number(course.studentCount || 0),
        }))
        .filter((course) => course.studentCount > 0);

      const res = await fetch("/api/admin/exam-scheduler/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          examType,
          termName,
          programIds: selectedProgramIds,
          dates,
          slots,
          rooms: selectedRooms.map((room) => ({
            id: room.id,
            roomCode: room.room_code,
            capacity: Number(room.capacity || 0),
          })),
          courses: cleanCourses,
          maxExamsPerBatchPerDay,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to generate schedule.");
      }

      setMessage(json.message || "Exam schedule generated.");
      setUnscheduled(json.result?.unscheduled || []);

      await loadSchedules();

      if (json.scheduleId) {
        await openSchedule(json.scheduleId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate schedule.");
    } finally {
      setLoading(false);
    }
  }

  async function openSchedule(scheduleId: number) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/exam-scheduler/schedules/${scheduleId}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load schedule.");
      }

      setSelectedScheduleId(scheduleId);
      setScheduleItems(json.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSchedule(scheduleId: number) {
    const ok = window.confirm("Delete this exam schedule?");
    if (!ok) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/exam-scheduler/schedules/${scheduleId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete schedule.");
      }

      setMessage(json.message || "Schedule deleted.");
      setScheduleItems([]);
      setSelectedScheduleId(null);
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete schedule.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(item: ScheduleItem) {
    setEditingItemId(item.id);
    setEditForm({
      examDate: dateOnly(item.exam_date),
      startTime: item.start_time,
      endTime: item.end_time,
      roomId: String(item.room_id || ""),
      seatPlanNote: item.seat_plan_note || "",
    });
  }

  async function saveEdit(itemId: number) {
    if (!selectedScheduleId) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/admin/exam-scheduler/schedules/${selectedScheduleId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            examDate: editForm.examDate,
            startTime: editForm.startTime,
            endTime: editForm.endTime,
            roomId: Number(editForm.roomId),
            seatPlanNote: editForm.seatPlanNote,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update schedule item.");
      }

      setMessage(json.message || "Schedule item updated.");
      setEditingItemId(null);
      await openSchedule(selectedScheduleId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update schedule item."
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleProgram(id: number) {
    setSelectedProgramIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleRoom(id: number) {
    setSelectedRoomIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function updateCourseStudentCount(index: number, value: string) {
    setCourses((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        studentCount: Number(value || 0),
      };
      return next;
    });
  }

  function addDate() {
    setDates((prev) => [...prev, todayText()]);
  }

  function updateDate(index: number, value: string) {
    setDates((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function removeDate(index: number) {
    setDates((prev) => prev.filter((_, i) => i !== index));
  }

  function addSlot() {
    setSlots((prev) => [...prev, { startTime: "13:00", endTime: "15:00" }]);
  }

  function updateSlot(index: number, field: keyof SlotRow, value: string) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  useEffect(() => {
    loadOptions();
    loadSchedules();
  }, []);

  return (
    <AdminLayout title="Auto Exam Scheduler">
      <div className="space-y-6">
        {(error || message) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            1. Exam Schedule Setup
          </h2>

          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Schedule Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Academic Term
              </label>
              <select
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.name}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Exam Type
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="MID">MID</option>
                <option value="FINAL">FINAL</option>
                <option value="CLASS_TEST">CLASS TEST</option>
                <option value="SPECIAL">SPECIAL</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Max Exams Per Batch Per Day
              </label>
              <select
                value={maxExamsPerBatchPerDay}
                onChange={(e) =>
                  setMaxExamsPerBatchPerDay(Number(e.target.value))
                }
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value={1}>1 Exam Per Batch Per Day</option>
                <option value={2}>2 Exams Per Batch Per Day</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              2. Programs
            </h2>

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {programs.map((program) => (
                <label
                  key={program.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedProgramIds.includes(program.id)}
                    onChange={() => toggleProgram(program.id)}
                  />
                  <span>
                    <b>{program.short_name}</b> — {program.name}
                  </span>
                </label>
              ))}
            </div>

            <button
              onClick={loadCourses}
              disabled={loading || !termName || selectedProgramIds.length === 0}
              className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Load Course Sections
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              3. Exam Dates
            </h2>

            <div className="mt-4 space-y-3">
              {dates.map((date, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => updateDate(index, e.target.value)}
                    className="w-full rounded-xl border px-4 py-3"
                  />
                  <button
                    type="button"
                    onClick={() => removeDate(index)}
                    className="rounded-xl bg-red-600 px-3 py-2 text-sm text-white"
                  >
                    X
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addDate}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
              >
                Add Date
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              4. Exam Slots
            </h2>

            <div className="mt-4 space-y-3">
              {slots.map((slot, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) =>
                      updateSlot(index, "startTime", e.target.value)
                    }
                    className="rounded-xl border px-3 py-3"
                  />
                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) =>
                      updateSlot(index, "endTime", e.target.value)
                    }
                    className="rounded-xl border px-3 py-3"
                  />
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="rounded-xl bg-red-600 px-3 py-2 text-sm text-white"
                  >
                    X
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addSlot}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
              >
                Add Slot
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            5. Rooms
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {rooms.map((room) => (
              <label
                key={room.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span>
                  <b>{room.room_code}</b>
                  <span className="text-slate-500">
                    {" "}
                    | {room.room_type || "ROOM"} | Cap: {room.capacity || 0}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={selectedRoomIds.includes(room.id)}
                  onChange={() => toggleRoom(room.id)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                6. Course Sections and Student Counts
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter student count for every course-section to be scheduled.
              </p>
            </div>

            <button
              onClick={generateSchedule}
              disabled={
                loading ||
                courses.length === 0 ||
                selectedRoomIds.length === 0 ||
                dates.length === 0 ||
                slots.length === 0
              }
              className="rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              Generate Auto Exam Schedule
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Program</th>
                  <th className="border-b px-3 py-3 text-left">Course</th>
                  <th className="border-b px-3 py-3 text-left">Section</th>
                  <th className="border-b px-3 py-3 text-left">Batches</th>
                  <th className="border-b px-3 py-3 text-left">Role</th>
                  <th className="border-b px-3 py-3 text-left">
                    Student Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course, index) => (
                  <tr key={`${course.offeredCourseId}-${index}`}>
                    <td className="border-b px-3 py-2">{course.programCode}</td>
                    <td className="border-b px-3 py-2">
                      <b>{course.courseCode}</b> — {course.courseTitle}
                    </td>
                    <td className="border-b px-3 py-2">{course.section}</td>
                    <td className="border-b px-3 py-2">
                      {course.batchCodes.join(", ") || "-"}
                    </td>
                    <td className="border-b px-3 py-2">{course.role || "-"}</td>
                    <td className="border-b px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={course.studentCount || ""}
                        onChange={(e) =>
                          updateCourseStudentCount(index, e.target.value)
                        }
                        className="w-32 rounded-xl border px-3 py-2"
                      />
                    </td>
                  </tr>
                ))}

                {courses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Load course sections first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {unscheduled.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <h3 className="font-semibold">Unscheduled Course Sections</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {unscheduled.map((row, index) => (
                  <li key={index}>
                    {row.courseCode} Sec-{row.section} | Batches:{" "}
                    {row.batchCodes?.join(", ") || "-"} | {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Saved Exam Schedules
            </h2>

            <div className="mt-4 space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="font-semibold text-slate-900">
                    {schedule.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {schedule.term_name} | {schedule.exam_type} | Rows:{" "}
                    {schedule.item_count}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => openSchedule(schedule.id)}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                    >
                      Open
                    </button>

                    <a
                      href={`/api/export/exam-schedule/${schedule.id}`}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"
                    >
                      XLSX
                    </a>

                    <button
                      onClick={() => deleteSchedule(schedule.id)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {schedules.length === 0 && (
                <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
                  No exam schedules created yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Generated Schedule Detail
            </h2>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border-b px-3 py-3 text-left">Date</th>
                    <th className="border-b px-3 py-3 text-left">Time</th>
                    <th className="border-b px-3 py-3 text-left">Room</th>
                    <th className="border-b px-3 py-3 text-left">Course</th>
                    <th className="border-b px-3 py-3 text-left">Sec</th>
                    <th className="border-b px-3 py-3 text-left">Batches</th>
                    <th className="border-b px-3 py-3 text-left">Students</th>
                    <th className="border-b px-3 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleItems.map((item) => (
                    <tr key={item.id}>
                      {editingItemId === item.id ? (
                        <>
                          <td className="border-b px-3 py-2">
                            <input
                              type="date"
                              value={editForm.examDate}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  examDate: e.target.value,
                                })
                              }
                              className="rounded-lg border px-2 py-2"
                            />
                          </td>
                          <td className="border-b px-3 py-2">
                            <div className="flex gap-2">
                              <input
                                type="time"
                                value={editForm.startTime}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    startTime: e.target.value,
                                  })
                                }
                                className="rounded-lg border px-2 py-2"
                              />
                              <input
                                type="time"
                                value={editForm.endTime}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    endTime: e.target.value,
                                  })
                                }
                                className="rounded-lg border px-2 py-2"
                              />
                            </div>
                          </td>
                          <td className="border-b px-3 py-2">
                            <select
                              value={editForm.roomId}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  roomId: e.target.value,
                                })
                              }
                              className="rounded-lg border px-2 py-2"
                            >
                              <option value="">Room</option>
                              {rooms.map((room) => (
                                <option key={room.id} value={room.id}>
                                  {room.room_code} | Cap {room.capacity}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border-b px-3 py-2">
                            <b>{item.course_code}</b> — {item.course_title}
                          </td>
                          <td className="border-b px-3 py-2">{item.section}</td>
                          <td className="border-b px-3 py-2">
                            {item.batch_codes}
                          </td>
                          <td className="border-b px-3 py-2">
                            {item.student_count}
                          </td>
                          <td className="border-b px-3 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(item.id)}
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingItemId(null)}
                                className="rounded-lg bg-slate-500 px-3 py-2 text-xs font-medium text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="border-b px-3 py-2">
                            {dateOnly(item.exam_date)}
                          </td>
                          <td className="border-b px-3 py-2">
                            {item.start_time} - {item.end_time}
                          </td>
                          <td className="border-b px-3 py-2">
                            {item.room_code} ({item.room_capacity})
                          </td>
                          <td className="border-b px-3 py-2">
                            <b>{item.course_code}</b> — {item.course_title}
                          </td>
                          <td className="border-b px-3 py-2">{item.section}</td>
                          <td className="border-b px-3 py-2">
                            {item.batch_codes}
                          </td>
                          <td className="border-b px-3 py-2">
                            {item.student_count}
                          </td>
                          <td className="border-b px-3 py-2">
                            <button
                              onClick={() => startEdit(item)}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"
                            >
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}

                  {scheduleItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Generate or open an exam schedule to view details.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedScheduleId && (
              <div className="mt-4">
                <a
                  href={`/api/export/exam-schedule/${selectedScheduleId}`}
                  className="inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Download XLSX
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
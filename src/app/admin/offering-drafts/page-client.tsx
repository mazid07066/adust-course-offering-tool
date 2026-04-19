"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramTermSelector from "@/components/program-term-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type RoomOption = {
  id: number;
  roomCode: string;
};

type Draft = {
  id: number;
  status: string;
  created_at: string | null;
  academic_terms: {
    name: string;
  };
  programs: {
    short_name: string;
    name: string;
  };
  offered_courses: Array<{
    id: number;
    section: string;
    master_courses: {
      course_code: string;
      course_title: string;
    };
    offered_course_batches: Array<{
      batches: {
        batch_code: string;
      };
    }>;
    offered_course_teachers: Array<{
      teachers: {
        teacher_code: string;
        full_name: string;
      } | null;
    }>;
    offered_course_slots: Array<{
      day_of_week: string;
      start_time: string;
      end_time: string;
      rooms: {
        room_code: string;
      } | null;
    }>;
  }>;
};

type DraftResponse = {
  ok?: boolean;
  error?: string;
  drafts?: Draft[];
};

type RoomResponse = {
  ok?: boolean;
  error?: string;
  rooms?: RoomOption[];
};

const DAYS = ["THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "MONDAY"];
const DURATIONS = [
  { value: "60", label: "1 Hour" },
  { value: "90", label: "1.5 Hours" },
  { value: "120", label: "2 Hours" },
  { value: "180", label: "3 Hours" },
];
const WEEKLY_CLASS_OPTIONS = [
  { value: "1", label: "Once in a week" },
  { value: "2", label: "Twice in a week" },
  { value: "3", label: "Thrice in a week" },
];

function addMinutesToTime(startTime: string, minutesToAdd: number) {
  const [hh, mm] = startTime.split(":").map(Number);
  const total = hh * 60 + mm + minutesToAdd;
  const endHour = Math.floor(total / 60) % 24;
  const endMinute = total % 60;

  return `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
}

export default function OfferingDraftsPageClient() {
  const {
    programs,
    programCode,
    setProgramCode,
    loadingPrograms,
    programError,
  } = useAcademicCatalogPrograms();

  const {
    terms,
    termName,
    setTermName,
    loadingTerms,
    termError,
  } = useAcademicTerms();

  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);

  const [slotEditorCourseId, setSlotEditorCourseId] = useState<number | null>(null);
  const [slotDay, setSlotDay] = useState("THURSDAY");
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState("60");
  const [slotWeeklyTarget, setSlotWeeklyTarget] = useState("1");
  const [slotRoomId, setSlotRoomId] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<number | null>(null);

  const slotEnd = useMemo(() => {
    return addMinutesToTime(slotStart, Number(slotDurationMinutes || 60));
  }, [slotStart, slotDurationMinutes]);

  async function loadAllRooms() {
    setRoomsLoading(true);

    try {
      const res = await fetch("/api/rooms/options", {
        method: "GET",
        cache: "no-store",
      });

      const json: RoomResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load room options.");
      }

      const fetchedRooms = json.rooms || [];
      setRooms(fetchedRooms);

      if (fetchedRooms.length > 0) {
        setSlotRoomId(String(fetchedRooms[0].id));
      } else {
        setSlotRoomId("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load room options.");
    } finally {
      setRoomsLoading(false);
    }
  }

  async function loadAvailableRooms(day: string, start: string, end: string) {
    setRoomsLoading(true);

    try {
      const params = new URLSearchParams({
        dayOfWeek: day,
        startTime: start,
        endTime: end,
      });

      const res = await fetch(`/api/rooms/options?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: RoomResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load available rooms.");
      }

      const fetchedRooms = json.rooms || [];
      setRooms(fetchedRooms);

      if (fetchedRooms.length > 0) {
        setSlotRoomId(String(fetchedRooms[0].id));
      } else {
        setSlotRoomId("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load available rooms.");
    } finally {
      setRoomsLoading(false);
    }
  }

  useEffect(() => {
    loadAllRooms();
  }, []);

  useEffect(() => {
    if (slotEditorCourseId) {
      loadAvailableRooms(slotDay, slotStart, slotEnd);
    }
  }, [slotEditorCourseId, slotDay, slotStart, slotEnd]);

  async function loadDrafts(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!programCode || !termName) {
      setError("Please select both academic identity and term.");
      setMessage("");
      setDrafts([]);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const params = new URLSearchParams({
        programCode,
        termName,
      });

      const res = await fetch(`/api/offerings/drafts?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: DraftResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load draft offerings.");
      }

      setDrafts(json.drafts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load draft offerings.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDraft(id: number) {
    const ok = window.confirm("Delete this full draft offering?");
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/offerings/drafts/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete draft offering.");
      }

      setMessage("Draft offering deleted successfully.");
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete draft offering.");
    }
  }

  async function deleteDraftCourse(offeredCourseId: number) {
    const ok = window.confirm("Delete this course from the draft?");
    if (!ok) return;

    setDeletingCourseId(offeredCourseId);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/offerings/drafts/courses/${offeredCourseId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete draft course.");
      }

      if (slotEditorCourseId === offeredCourseId) {
        setSlotEditorCourseId(null);
      }

      setMessage("Draft course deleted successfully.");
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete draft course.");
    } finally {
      setDeletingCourseId(null);
    }
  }

  async function publishDraft(id: number) {
    const ok = window.confirm("Publish this draft offering?");
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/offerings/drafts/${id}/publish`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to publish draft offering.");
      }

      setMessage("Draft offering published successfully.");
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish draft offering.");
    }
  }

  async function saveSlot() {
    if (!slotEditorCourseId) {
      setError("No offered course selected for slot scheduling.");
      setMessage("");
      return;
    }

    if (!slotRoomId) {
      setError("No available room found for this selected time. Please change day or time, or create rooms first.");
      setMessage("");
      return;
    }

    setSavingSlot(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/offerings/drafts/slots/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offeredCourseId: slotEditorCourseId,
          dayOfWeek: slotDay,
          startTime: slotStart,
          endTime: slotEnd,
          roomId: Number(slotRoomId),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save slot.");
      }

      setMessage("Slot added successfully.");
      setSlotEditorCourseId(null);
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save slot.");
    } finally {
      setSavingSlot(false);
    }
  }

  const combinedError = error || programError || termError;
  const configuredRoomCount = rooms.length;

  return (
    <AdminLayout title="Draft Offerings">
      <div className="space-y-6">
        <form onSubmit={loadDrafts} className="space-y-4">
          <ProgramTermSelector
            programs={programs}
            programCode={programCode}
            setProgramCode={setProgramCode}
            loadingPrograms={loadingPrograms}
            terms={terms}
            termName={termName}
            setTermName={setTermName}
            loadingTerms={loadingTerms}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || !programCode || !termName}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Drafts"}
            </button>

            <button
              type="button"
              onClick={loadAllRooms}
              disabled={roomsLoading}
              className="rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-60"
            >
              {roomsLoading ? "Loading Rooms..." : "Reload Rooms"}
            </button>

            <a
              href="/admin/rooms"
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open Rooms Setup
            </a>
          </div>
        </form>

        {configuredRoomCount === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No active room is available yet. Please open Rooms Setup and create at least one active room before slot assignment.
          </div>
        )}

        {combinedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="space-y-4">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {draft.programs.short_name} — {draft.academic_terms.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Draft ID: {draft.id} | Status: {draft.status}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => publishDraft(draft.id)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Publish Draft
                  </button>

                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete Draft
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-3 text-left">Course</th>
                      <th className="border-b px-3 py-3 text-left">Section</th>
                      <th className="border-b px-3 py-3 text-left">Batches</th>
                      <th className="border-b px-3 py-3 text-left">Faculty</th>
                      <th className="border-b px-3 py-3 text-left">Schedule</th>
                      <th className="border-b px-3 py-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.offered_courses.map((course) => {
                      const currentSlotCount = course.offered_course_slots.length;

                      return (
                        <Fragment key={course.id}>
                          <tr>
                            <td className="border-b px-3 py-2">
                              {course.master_courses.course_code} — {course.master_courses.course_title}
                            </td>
                            <td className="border-b px-3 py-2">{course.section}</td>
                            <td className="border-b px-3 py-2">
                              {course.offered_course_batches.map((b) => b.batches.batch_code).join(", ")}
                            </td>
                            <td className="border-b px-3 py-2">
                              {course.offered_course_teachers.length === 0
                                ? "-"
                                : course.offered_course_teachers
                                    .map((t) => t.teachers?.teacher_code || "-")
                                    .join(", ")}
                            </td>
                            <td className="border-b px-3 py-2">
                              {course.offered_course_slots.length === 0
                                ? "-"
                                : course.offered_course_slots.map((s, i) => (
                                    <div key={i}>
                                      {s.day_of_week} {s.start_time}-{s.end_time} ({s.rooms?.room_code || "-"})
                                    </div>
                                  ))}
                            </td>
                            <td className="border-b px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSlotEditorCourseId(course.id);
                                    setSlotWeeklyTarget(
                                      String(
                                        Math.min(
                                          Math.max(currentSlotCount || 1, 1),
                                          3
                                        )
                                      )
                                    );
                                  }}
                                  disabled={currentSlotCount >= 3}
                                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                  {currentSlotCount >= 3 ? "Max 3 Reached" : "Add Slot"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteDraftCourse(course.id)}
                                  disabled={deletingCourseId === course.id}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  {deletingCourseId === course.id ? "Deleting..." : "Delete Course"}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {slotEditorCourseId === course.id && (
                            <tr>
                              <td colSpan={6} className="bg-slate-50 px-4 py-4">
                                <div className="grid gap-4 md:grid-cols-6">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Day
                                    </label>
                                    <select
                                      value={slotDay}
                                      onChange={(e) => setSlotDay(e.target.value)}
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
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Start Time
                                    </label>
                                    <input
                                      type="time"
                                      value={slotStart}
                                      onChange={(e) => setSlotStart(e.target.value)}
                                      className="w-full rounded-xl border px-4 py-3"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Duration
                                    </label>
                                    <select
                                      value={slotDurationMinutes}
                                      onChange={(e) => setSlotDurationMinutes(e.target.value)}
                                      className="w-full rounded-xl border px-4 py-3"
                                    >
                                      {DURATIONS.map((item) => (
                                        <option key={item.value} value={item.value}>
                                          {item.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      End Time
                                    </label>
                                    <input
                                      value={slotEnd}
                                      readOnly
                                      className="w-full rounded-xl border bg-slate-100 px-4 py-3"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Weekly Plan
                                    </label>
                                    <select
                                      value={slotWeeklyTarget}
                                      onChange={(e) => setSlotWeeklyTarget(e.target.value)}
                                      className="w-full rounded-xl border px-4 py-3"
                                    >
                                      {WEEKLY_CLASS_OPTIONS.map((item) => (
                                        <option key={item.value} value={item.value}>
                                          {item.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Current Slots
                                    </label>
                                    <input
                                      value={`${currentSlotCount} / ${slotWeeklyTarget}`}
                                      readOnly
                                      className="w-full rounded-xl border bg-slate-100 px-4 py-3"
                                    />
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Available Room
                                    </label>
                                    <select
                                      value={slotRoomId}
                                      onChange={(e) => setSlotRoomId(e.target.value)}
                                      className="w-full rounded-xl border px-4 py-3"
                                      disabled={roomsLoading || rooms.length === 0}
                                    >
                                      {rooms.length === 0 ? (
                                        <option value="">No available room</option>
                                      ) : (
                                        rooms.map((room) => (
                                          <option key={room.id} value={room.id}>
                                            {room.roomCode}
                                          </option>
                                        ))
                                      )}
                                    </select>
                                  </div>

                                  <div className="flex items-end">
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                                      {roomsLoading
                                        ? "Checking room availability..."
                                        : rooms.length === 0
                                        ? "No room available for this day/time."
                                        : `${rooms.length} room(s) available for this day/time.`}
                                    </div>
                                  </div>

                                  <div className="flex items-end gap-2">
                                    <button
                                      type="button"
                                      onClick={saveSlot}
                                      disabled={savingSlot || rooms.length === 0 || currentSlotCount >= 3}
                                      className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                      {savingSlot ? "Saving..." : "Save Slot"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setSlotEditorCourseId(null)}
                                      className="rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}

                    {draft.offered_courses.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                          No courses found in this draft.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {drafts.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              No draft offerings found for the selected academic identity and term.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
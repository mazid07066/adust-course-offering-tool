"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramTermSelector from "@/components/program-term-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type RoomOption = {
  id: number;
  room_code: string;
  room_type?: string | null;
};

type DraftSlot = {
  id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_id: number;
  slot_type?: string | null;
  rooms: {
    room_code: string;
    room_type?: string | null;
  } | null;
};

type LinkedCourseRow = {
  id: number;
  section: string;
  master_course: {
    course_code: string;
    course_title: string;
    program_code: string;
    program_name: string;
  };
  offered_course_batches: Array<{
    batch_id: number;
    batches: {
      batch_code: string;
    };
  }>;
};

type SectionGroup = {
  primary_course: {
    id: number;
    section: string;
    is_cooffered: boolean;
    master_course: {
      course_code: string;
      course_title: string;
      program_code: string;
      program_name: string;
    };
    offered_course_batches: Array<{
      batch_id: number;
      batches: {
        batch_code: string;
      };
    }>;
    offered_course_teachers: Array<{
      teacher_id: number;
      teachers: {
        teacher_code: string;
        full_name: string;
      } | null;
    }>;
    offered_course_slots: DraftSlot[];
    schedule_text?: string;
  };
  linked_courses: LinkedCourseRow[];
  section_batch_codes: string[];
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
  section_groups: SectionGroup[];
};

type DraftResponse = {
  ok?: boolean;
  error?: string;
  matchedProgramCodes?: string[];
  drafts?: Draft[];
};

type RoomResponse = {
  ok?: boolean;
  error?: string;
  rooms?: Array<
    | {
        id: number;
        room_code: string;
        room_type?: string | null;
      }
    | {
        id: number;
        roomCode: string;
        roomType?: string | null;
      }
  >;
};

type ProgramBatchResponse = {
  ok?: boolean;
  error?: string;
  batches?: Array<
    | {
        id: number;
        batch_code: string;
      }
    | {
        id: number;
        batchCode: string;
      }
  >;
};

type SlotEditorRow = {
  dayOfWeek: string;
  startTime: string;
  durationMinutes: string;
  roomId: string;
  availableRooms: RoomOption[];
  loadingRooms: boolean;
};

type BatchOption = {
  id: number;
  batchCode: string;
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

function roomLabel(
  room:
    | { room_code: string; room_type?: string | null }
    | { roomCode: string; roomType?: string | null }
    | null
    | undefined
) {
  if (!room) return "-";

  if ("room_code" in room) {
    return room.room_type ? `${room.room_type} | ${room.room_code}` : room.room_code;
  }

  return room.roomType ? `${room.roomType} | ${room.roomCode}` : room.roomCode;
}

function normalizeRoomOption(
  room:
    | { id: number; room_code: string; room_type?: string | null }
    | { id: number; roomCode: string; roomType?: string | null }
): RoomOption {
  if ("room_code" in room) {
    return {
      id: room.id,
      room_code: room.room_code,
      room_type: room.room_type ?? null,
    };
  }

  return {
    id: room.id,
    room_code: room.roomCode,
    room_type: room.roomType ?? null,
  };
}

function normalizeBatchOption(
  row:
    | {
        id: number;
        batch_code: string;
      }
    | {
        id: number;
        batchCode: string;
      }
): BatchOption {
  if ("batch_code" in row) {
    return {
      id: row.id,
      batchCode: row.batch_code,
    };
  }

  return {
    id: row.id,
    batchCode: row.batchCode,
  };
}

function buildDefaultSlotRow(initialRoomId = ""): SlotEditorRow {
  return {
    dayOfWeek: "THURSDAY",
    startTime: "09:00",
    durationMinutes: "60",
    roomId: initialRoomId,
    availableRooms: [],
    loadingRooms: false,
  };
}

function getRemainingSlotCount(currentSlotCount: number, weeklyTarget: string) {
  const target = Number(weeklyTarget || "1");
  return Math.max(1, target - currentSlotCount);
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
  const [matchedProgramCodes, setMatchedProgramCodes] = useState<string[]>([]);

  const [allRooms, setAllRooms] = useState<RoomOption[]>([]);

  const [slotEditorCourseId, setSlotEditorCourseId] = useState<number | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [slotWeeklyTarget, setSlotWeeklyTarget] = useState("1");
  const [slotRows, setSlotRows] = useState<SlotEditorRow[]>([]);

  const [savingSlot, setSavingSlot] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<number | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<number | null>(null);

  const [attachEditorCourseId, setAttachEditorCourseId] = useState<number | null>(null);
  const [attachProgramCode, setAttachProgramCode] = useState("");
  const [attachBatchCode, setAttachBatchCode] = useState("");
  const [attachBatchOptions, setAttachBatchOptions] = useState<BatchOption[]>([]);
  const [attachOptionsLoading, setAttachOptionsLoading] = useState(false);
  const [savingAttach, setSavingAttach] = useState(false);

  const combinedError = error || programError || termError;
  const configuredRoomCount = allRooms.length;

  function getPrimaryCourseById(courseId: number) {
    for (const draft of drafts) {
      for (const group of draft.section_groups) {
        if (group.primary_course.id === courseId) {
          return group.primary_course;
        }
      }
    }
    return null;
  }

  function currentCourseSlotCount() {
    if (!slotEditorCourseId) return 0;
    const course = getPrimaryCourseById(slotEditorCourseId);
    return course?.offered_course_slots.length || 0;
  }

  function resizeSlotRows(targetCount: number) {
    setSlotRows((prev) => {
      const next = [...prev];
      if (next.length < targetCount) {
        const fallbackRoomId =
          next[0]?.roomId || (allRooms.length > 0 ? String(allRooms[0].id) : "");
        while (next.length < targetCount) {
          next.push(buildDefaultSlotRow(fallbackRoomId));
        }
      } else if (next.length > targetCount) {
        next.length = targetCount;
      }
      return next;
    });
  }

  function openSlotEditorForNew(courseId: number) {
    const course = getPrimaryCourseById(courseId);
    const currentSlotCount = course?.offered_course_slots.length || 0;
    const initialTarget = currentSlotCount === 0 ? "1" : currentSlotCount === 1 ? "2" : "3";
    const rowCount = getRemainingSlotCount(currentSlotCount, initialTarget);

    setSlotEditorCourseId(courseId);
    setEditingSlotId(null);
    setSlotWeeklyTarget(initialTarget);
    setSlotRows(
      Array.from({ length: rowCount }, () =>
        buildDefaultSlotRow(allRooms.length > 0 ? String(allRooms[0].id) : "")
      )
    );
  }

  function openSlotEditorForEdit(courseId: number, slot: DraftSlot) {
    const start = slot.start_time;
    const end = slot.end_time;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const duration = String(Math.max(60, eh * 60 + em - (sh * 60 + sm)));

    setSlotEditorCourseId(courseId);
    setEditingSlotId(slot.id);
    setSlotWeeklyTarget("1");
    setSlotRows([
      {
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        durationMinutes: duration,
        roomId: String(slot.room_id),
        availableRooms: [],
        loadingRooms: false,
      },
    ]);
  }

  function closeSlotEditor() {
    setSlotEditorCourseId(null);
    setEditingSlotId(null);
    setSlotWeeklyTarget("1");
    setSlotRows([]);
  }

  async function loadAttachBatchOptions(selectedProgramCode: string) {
    if (!selectedProgramCode) {
      setAttachBatchOptions([]);
      return;
    }

    setAttachOptionsLoading(true);

    try {
      const params = new URLSearchParams({
        programCode: selectedProgramCode,
      });

      const res = await fetch(`/api/program-batches/options?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: ProgramBatchResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load batches.");
      }

      setAttachBatchOptions((json.batches || []).map(normalizeBatchOption));
    } catch (err) {
      setAttachBatchOptions([]);
      setError(err instanceof Error ? err.message : "Failed to load batches.");
    } finally {
      setAttachOptionsLoading(false);
    }
  }

  function openAttachEditor(courseId: number, defaultProgramCode: string) {
    setAttachEditorCourseId(courseId);
    setAttachProgramCode(defaultProgramCode);
    setAttachBatchCode("");
    setAttachBatchOptions([]);
    void loadAttachBatchOptions(defaultProgramCode);
  }

  function closeAttachEditor() {
    setAttachEditorCourseId(null);
    setAttachProgramCode("");
    setAttachBatchCode("");
    setAttachBatchOptions([]);
  }

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

      const fetchedRooms = (json.rooms || []).map(normalizeRoomOption);
      setAllRooms(fetchedRooms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load room options.");
    } finally {
      setRoomsLoading(false);
    }
  }

  async function loadAvailableRoomsForRow(index: number, preferredRoomId?: string) {
    const row = slotRows[index];
    if (!row) return;

    const endTime = addMinutesToTime(row.startTime, Number(row.durationMinutes || 60));

    setSlotRows((prev) =>
      prev.map((item, i) => (i === index ? { ...item, loadingRooms: true } : item))
    );

    try {
      const params = new URLSearchParams({
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime,
      });

      const res = await fetch(`/api/rooms/options?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: RoomResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load available rooms.");
      }

      const fetchedRooms = (json.rooms || []).map(normalizeRoomOption);

      setSlotRows((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;

          let nextRoomId = item.roomId;

          if (fetchedRooms.length === 0) {
            nextRoomId = "";
          } else if (
            preferredRoomId &&
            fetchedRooms.some((room) => String(room.id) === preferredRoomId)
          ) {
            nextRoomId = preferredRoomId;
          } else if (
            item.roomId &&
            fetchedRooms.some((room) => String(room.id) === item.roomId)
          ) {
            nextRoomId = item.roomId;
          } else {
            nextRoomId = String(fetchedRooms[0].id);
          }

          return {
            ...item,
            availableRooms: fetchedRooms,
            roomId: nextRoomId,
            loadingRooms: false,
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load available rooms.");
      setSlotRows((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, loadingRooms: false, availableRooms: [] } : item
        )
      );
    }
  }

  useEffect(() => {
    void loadAllRooms();
  }, []);

  useEffect(() => {
    if (!slotEditorCourseId || editingSlotId) return;

    const currentCount = currentCourseSlotCount();
    const desiredRows = getRemainingSlotCount(currentCount, slotWeeklyTarget);
    resizeSlotRows(desiredRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotWeeklyTarget, slotEditorCourseId, editingSlotId]);

  useEffect(() => {
    if (!slotEditorCourseId || slotRows.length === 0) return;

    slotRows.forEach((row, index) => {
      void loadAvailableRoomsForRow(index, row.roomId || undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slotEditorCourseId,
    slotRows.map((row) => `${row.dayOfWeek}|${row.startTime}|${row.durationMinutes}`).join("||"),
  ]);

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

      setMatchedProgramCodes(json.matchedProgramCodes || []);
      setDrafts(json.drafts || []);

      if ((json.drafts || []).length === 0) {
        setMessage("No draft offerings found for the selected academic identity and term.");
      } else {
        setMessage("");
      }
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
    const ok = window.confirm(
      "Delete this course row? If it is a primary section, linked secondaries under it will also be removed."
    );
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
        closeSlotEditor();
      }

      setMessage("Draft course deleted successfully.");
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete draft course.");
    } finally {
      setDeletingCourseId(null);
    }
  }

  async function deleteSlot(slotId: number) {
    const ok = window.confirm("Delete this slot?");
    if (!ok) return;

    setDeletingSlotId(slotId);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/offerings/drafts/slots/${slotId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete slot.");
      }

      if (editingSlotId === slotId) {
        closeSlotEditor();
      }

      setMessage("Slot deleted successfully.");
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete slot.");
    } finally {
      setDeletingSlotId(null);
    }
  }

  async function publishDraft(id: number) {
    const ok = window.confirm(
      "Move this offering to BUFFER_READY so it becomes ready for the faculty-choice phase?"
    );
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/offerings/drafts/${id}/publish`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        const blockerText =
          Array.isArray(json.blockers) && json.blockers.length > 0
            ? `\n\nBlockers:\n- ${json.blockers.join("\n- ")}`
            : "";

        throw new Error(
          (json.error || "Failed to move offering to BUFFER_READY.") + blockerText
        );
      }

      setMessage(
        "Offering moved to BUFFER_READY. It is now prepared for the upcoming faculty-choice phase."
      );
      await loadDrafts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to move offering to BUFFER_READY."
      );
    }
  }

  async function saveAttachBatch() {
    if (!attachEditorCourseId || !attachProgramCode || !attachBatchCode) {
      setError("Please choose both academic identity and batch.");
      setMessage("");
      return;
    }

    setSavingAttach(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/offerings/drafts/attach-batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offeredCourseId: attachEditorCourseId,
          programCode: attachProgramCode,
          batchCode: attachBatchCode,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to attach batch.");
      }

      setMessage("Batch attached successfully.");
      closeAttachEditor();
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach batch.");
    } finally {
      setSavingAttach(false);
    }
  }

  function updateSlotRow(index: number, patch: Partial<SlotEditorRow>) {
    setSlotRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  async function saveSlot() {
    if (!slotEditorCourseId) {
      setError("No offered course selected for slot scheduling.");
      setMessage("");
      return;
    }

    if (slotRows.length === 0) {
      setError("No slot rows are ready to save.");
      setMessage("");
      return;
    }

    setSavingSlot(true);
    setError("");
    setMessage("");

    try {
      if (editingSlotId) {
        const row = slotRows[0];
        const endTime = addMinutesToTime(row.startTime, Number(row.durationMinutes || 60));

        if (!row.roomId) {
          throw new Error("Please select a room for the slot.");
        }

        const res = await fetch(`/api/offerings/drafts/slots/${editingSlotId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dayOfWeek: row.dayOfWeek,
            startTime: row.startTime,
            endTime,
            roomId: Number(row.roomId),
            slotType: "CLASS",
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to update slot.");
        }

        await loadDrafts();
        setMessage("Slot updated successfully.");
        closeSlotEditor();
        return;
      }

      for (let i = 0; i < slotRows.length; i += 1) {
        const row = slotRows[i];
        const endTime = addMinutesToTime(row.startTime, Number(row.durationMinutes || 60));

        if (!row.roomId) {
          throw new Error(`Please select a room for slot ${i + 1}.`);
        }

        const res = await fetch("/api/offerings/drafts/slots/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            offeredCourseId: slotEditorCourseId,
            dayOfWeek: row.dayOfWeek,
            startTime: row.startTime,
            endTime,
            roomId: Number(row.roomId),
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || `Failed to save slot ${i + 1}.`);
        }
      }

      await loadDrafts();
      setMessage(`${slotRows.length} slot(s) saved successfully.`);
      closeSlotEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save slots.");
    } finally {
      setSavingSlot(false);
    }
  }

  const draftCount = useMemo(() => drafts.length, [drafts]);

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
              onClick={() => void loadAllRooms()}
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

            <a
              href={`/admin/co-offering-setup?termName=${encodeURIComponent(termName || "")}&primaryProgramCode=${encodeURIComponent(programCode || "")}`}
              className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Open Co-offering Setup
            </a>
          </div>
        </form>

        {configuredRoomCount === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No active room is available yet. Please open Rooms Setup and create at least one active room before slot assignment.
          </div>
        )}

        {combinedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">
            {combinedError}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {matchedProgramCodes.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Draft lookup matched program(s): {matchedProgramCodes.join(", ")}
          </div>
        )}

        {draftCount > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Section-group view active. Each row below is one operational teaching section.
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
                    Open for Faculty Choice
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
                      <th className="border-b px-3 py-3 text-left">Section Group</th>
                      <th className="border-b px-3 py-3 text-left">All Batches</th>
                      <th className="border-b px-3 py-3 text-left">Faculty</th>
                      <th className="border-b px-3 py-3 text-left">Schedule</th>
                      <th className="border-b px-3 py-3 text-left">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {draft.section_groups.map((group) => {
                      const currentSlotCount = group.primary_course.offered_course_slots.length;
                      const remainingCount = editingSlotId
                        ? 1
                        : getRemainingSlotCount(currentSlotCount, slotWeeklyTarget);

                      return (
                        <Fragment key={group.primary_course.id}>
                          <tr>
                            <td className="border-b px-3 py-3 align-top">
                              <div className="space-y-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Primary
                                  </div>
                                  <div className="mt-1 font-medium text-slate-900">
                                    {group.primary_course.master_course.course_code} — {group.primary_course.master_course.course_title}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-600">
                                    Program: {group.primary_course.master_course.program_code}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-600">
                                    Section: {group.primary_course.section}
                                  </div>
                                  <div className="mt-2 text-xs text-slate-600">
                                    Batches:{" "}
                                    {group.primary_course.offered_course_batches
                                      .map((b) => b.batches.batch_code)
                                      .join(", ") || "-"}
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openAttachEditor(
                                          group.primary_course.id,
                                          draft.programs.short_name
                                        )
                                      }
                                      className="rounded-lg border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                                    >
                                      Add Batch
                                    </button>

                                    <a
                                      href={`/admin/co-offering-setup?termName=${encodeURIComponent(termName || draft.academic_terms.name)}&primaryProgramCode=${encodeURIComponent(programCode || draft.programs.short_name)}&primaryOfferedCourseId=${group.primary_course.id}`}
                                      className="rounded-lg border px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-white"
                                    >
                                      Manage Co-offering
                                    </a>
                                  </div>

                                  {attachEditorCourseId === group.primary_course.id && (
                                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                                      <div className="grid gap-3 md:grid-cols-2">
                                        <div>
                                          <label className="mb-2 block text-xs font-medium text-slate-700">
                                            Academic Identity
                                          </label>
                                          <select
                                            value={attachProgramCode}
                                            onChange={(e) => {
                                              setAttachProgramCode(e.target.value);
                                              setAttachBatchCode("");
                                              void loadAttachBatchOptions(e.target.value);
                                            }}
                                            className="w-full rounded-lg border px-3 py-2 text-sm"
                                          >
                                            <option value="">Select program</option>
                                            {programs.map((item, index) => (
                                              <option
                                                key={`${item.programCode}-${index}`}
                                                value={item.programCode}
                                              >
                                                {item.displayLabel}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="mb-2 block text-xs font-medium text-slate-700">
                                            Batch
                                          </label>
                                          <select
                                            value={attachBatchCode}
                                            onChange={(e) => setAttachBatchCode(e.target.value)}
                                            className="w-full rounded-lg border px-3 py-2 text-sm"
                                            disabled={!attachProgramCode || attachOptionsLoading}
                                          >
                                            <option value="">
                                              {attachOptionsLoading ? "Loading batches..." : "Select batch"}
                                            </option>
                                            {attachBatchOptions.map((item) => (
                                              <option key={`attach-${item.id}`} value={item.batchCode}>
                                                {item.batchCode}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      <div className="mt-3 flex gap-2">
                                        <button
                                          type="button"
                                          onClick={saveAttachBatch}
                                          disabled={savingAttach || !attachProgramCode || !attachBatchCode}
                                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                                        >
                                          {savingAttach ? "Saving..." : "Save Batch"}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={closeAttachEditor}
                                          className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-300"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {group.linked_courses.length > 0 && (
                                  <div className="space-y-2">
                                    {group.linked_courses.map((linked) => (
                                      <div
                                        key={linked.id}
                                        className="rounded-xl border border-indigo-200 bg-indigo-50 p-3"
                                      >
                                        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                                          Linked Secondary
                                        </div>
                                        <div className="mt-1 font-medium text-slate-900">
                                          {linked.master_course.course_code} — {linked.master_course.course_title}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-600">
                                          Program: {linked.master_course.program_code}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-600">
                                          Section: {linked.section}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-600">
                                          Batches:{" "}
                                          {linked.offered_course_batches
                                            .map((b) => b.batches.batch_code)
                                            .join(", ") || "-"}
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openAttachEditor(linked.id, linked.master_course.program_code)
                                            }
                                            className="rounded-lg border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                                          >
                                            Add Batch
                                          </button>

                                          <a
                                            href={`/admin/co-offering-setup?termName=${encodeURIComponent(termName || draft.academic_terms.name)}&primaryProgramCode=${encodeURIComponent(programCode || draft.programs.short_name)}&primaryOfferedCourseId=${group.primary_course.id}`}
                                            className="rounded-lg border px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-white"
                                          >
                                            Manage Co-offering
                                          </a>

                                          <button
                                            type="button"
                                            onClick={() => deleteDraftCourse(linked.id)}
                                            disabled={deletingCourseId === linked.id}
                                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                                          >
                                            {deletingCourseId === linked.id ? "Deleting..." : "Remove Link"}
                                          </button>
                                        </div>

                                        {attachEditorCourseId === linked.id && (
                                          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="grid gap-3 md:grid-cols-2">
                                              <div>
                                                <label className="mb-2 block text-xs font-medium text-slate-700">
                                                  Academic Identity
                                                </label>
                                                <select
                                                  value={attachProgramCode}
                                                  onChange={(e) => {
                                                    setAttachProgramCode(e.target.value);
                                                    setAttachBatchCode("");
                                                    void loadAttachBatchOptions(e.target.value);
                                                  }}
                                                  className="w-full rounded-lg border px-3 py-2 text-sm"
                                                >
                                                  <option value="">Select program</option>
                                                  {programs.map((item, index) => (
                                                    <option
                                                      key={`${item.programCode}-${index}`}
                                                      value={item.programCode}
                                                    >
                                                      {item.displayLabel}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>

                                              <div>
                                                <label className="mb-2 block text-xs font-medium text-slate-700">
                                                  Batch
                                                </label>
                                                <select
                                                  value={attachBatchCode}
                                                  onChange={(e) => setAttachBatchCode(e.target.value)}
                                                  className="w-full rounded-lg border px-3 py-2 text-sm"
                                                  disabled={!attachProgramCode || attachOptionsLoading}
                                                >
                                                  <option value="">
                                                    {attachOptionsLoading ? "Loading batches..." : "Select batch"}
                                                  </option>
                                                  {attachBatchOptions.map((item) => (
                                                    <option key={`attach-linked-${item.id}`} value={item.batchCode}>
                                                      {item.batchCode}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                            </div>

                                            <div className="mt-3 flex gap-2">
                                              <button
                                                type="button"
                                                onClick={saveAttachBatch}
                                                disabled={savingAttach || !attachProgramCode || !attachBatchCode}
                                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                                              >
                                                {savingAttach ? "Saving..." : "Save Batch"}
                                              </button>

                                              <button
                                                type="button"
                                                onClick={closeAttachEditor}
                                                className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-300"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="border-b px-3 py-3 align-top">
                              {group.section_batch_codes.join(", ") || "-"}
                            </td>

                            <td className="border-b px-3 py-3 align-top">
                              {group.primary_course.offered_course_teachers.length === 0
                                ? "-"
                                : group.primary_course.offered_course_teachers
                                    .map((t) => t.teachers?.teacher_code || "-")
                                    .join(", ")}
                            </td>

                            <td className="border-b px-3 py-3 align-top">
                              {group.primary_course.offered_course_slots.length === 0 ? (
                                "-"
                              ) : (
                                <div className="space-y-2">
                                  {group.primary_course.offered_course_slots.map((slot) => (
                                    <div
                                      key={slot.id}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                    >
                                      <div className="text-xs font-medium text-slate-800">
                                        {slot.day_of_week} {slot.start_time}-{slot.end_time}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-600">
                                        {roomLabel(slot.rooms)}
                                      </div>
                                      <div className="mt-2 flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openSlotEditorForEdit(group.primary_course.id, slot)
                                          }
                                          className="rounded-lg border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                                        >
                                          Edit
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => deleteSlot(slot.id)}
                                          disabled={deletingSlotId === slot.id}
                                          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                                        >
                                          {deletingSlotId === slot.id ? "Deleting..." : "Delete"}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>

                            <td className="border-b px-3 py-3 align-top">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openSlotEditorForNew(group.primary_course.id)}
                                  disabled={currentSlotCount >= 3}
                                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                  {currentSlotCount >= 3
                                    ? "Max 3 Reached"
                                    : currentSlotCount > 0
                                      ? "Add Remaining Slot(s)"
                                      : "Add Slot(s)"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteDraftCourse(group.primary_course.id)}
                                  disabled={deletingCourseId === group.primary_course.id}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  {deletingCourseId === group.primary_course.id ? "Deleting..." : "Delete Section"}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {slotEditorCourseId === group.primary_course.id && (
                            <tr>
                              <td colSpan={5} className="bg-slate-50 px-4 py-4">
                                <div className="mb-4 grid gap-4 md:grid-cols-3">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Weekly Plan
                                    </label>
                                    <select
                                      value={slotWeeklyTarget}
                                      onChange={(e) => setSlotWeeklyTarget(e.target.value)}
                                      className="w-full rounded-xl border px-4 py-3"
                                      disabled={Boolean(editingSlotId)}
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
                                      Current Saved Slots
                                    </label>
                                    <input
                                      value={`${currentSlotCount}`}
                                      readOnly
                                      className="w-full rounded-xl border bg-slate-100 px-4 py-3"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      Rows To Fill Now
                                    </label>
                                    <input
                                      value={editingSlotId ? "1" : `${remainingCount}`}
                                      readOnly
                                      className="w-full rounded-xl border bg-slate-100 px-4 py-3"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  {slotRows.map((row, index) => {
                                    const endTime = addMinutesToTime(
                                      row.startTime,
                                      Number(row.durationMinutes || 60)
                                    );

                                    return (
                                      <div
                                        key={index}
                                        className="rounded-2xl border border-slate-200 bg-white p-4"
                                      >
                                        <div className="mb-3 text-sm font-semibold text-slate-800">
                                          {editingSlotId ? "Edit Slot" : `Slot ${index + 1}`}
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-6">
                                          <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                              Day
                                            </label>
                                            <select
                                              value={row.dayOfWeek}
                                              onChange={(e) =>
                                                updateSlotRow(index, { dayOfWeek: e.target.value })
                                              }
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
                                              value={row.startTime}
                                              onChange={(e) =>
                                                updateSlotRow(index, { startTime: e.target.value })
                                              }
                                              className="w-full rounded-xl border px-4 py-3"
                                            />
                                          </div>

                                          <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                              Duration
                                            </label>
                                            <select
                                              value={row.durationMinutes}
                                              onChange={(e) =>
                                                updateSlotRow(index, {
                                                  durationMinutes: e.target.value,
                                                })
                                              }
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
                                              value={endTime}
                                              readOnly
                                              className="w-full rounded-xl border bg-slate-100 px-4 py-3"
                                            />
                                          </div>

                                          <div className="md:col-span-2">
                                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                              Available Room
                                            </label>
                                            <select
                                              value={row.roomId}
                                              onChange={(e) =>
                                                updateSlotRow(index, { roomId: e.target.value })
                                              }
                                              className="w-full rounded-xl border px-4 py-3"
                                              disabled={row.loadingRooms || row.availableRooms.length === 0}
                                            >
                                              {row.availableRooms.length === 0 ? (
                                                <option value="">No available room</option>
                                              ) : (
                                                row.availableRooms.map((room) => (
                                                  <option key={room.id} value={room.id}>
                                                    {roomLabel(room)}
                                                  </option>
                                                ))
                                              )}
                                            </select>
                                          </div>
                                        </div>

                                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                          {row.loadingRooms
                                            ? "Checking room availability..."
                                            : row.availableRooms.length === 0
                                              ? "No room available for this day/time."
                                              : `${row.availableRooms.length} room(s) available for this slot.`}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-4 flex items-end gap-2">
                                  <button
                                    type="button"
                                    onClick={saveSlot}
                                    disabled={
                                      savingSlot ||
                                      slotRows.length === 0 ||
                                      slotRows.some(
                                        (row) =>
                                          row.loadingRooms ||
                                          row.availableRooms.length === 0 ||
                                          !row.roomId
                                      )
                                    }
                                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    {savingSlot
                                      ? editingSlotId
                                        ? "Updating..."
                                        : "Saving..."
                                      : editingSlotId
                                        ? "Update Slot"
                                        : slotRows.length > 1
                                          ? "Save All Slots"
                                          : "Save Slot"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={closeSlotEditor}
                                    className="rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}

                    {draft.section_groups.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                          No section groups found in this draft.
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
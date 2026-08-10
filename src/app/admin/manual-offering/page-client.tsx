"use client";

import PrecreateManualCoOffer from "@/components/offerings/precreate-manual-co-offer";
import { useEffect, useMemo, useState } from "react";

type TermOption = {
  id: number;
  name: string;
  year: number;
  termType: string;
  active: boolean;
};

type ProgramOption = {
  id: number;
  programCode: string;
  programName: string;
  departmentCode: string;
  departmentName: string;
  displayLabel: string;
};

type BatchOption = {
  id: number;
  batchCode: string;
  admissionTerm: string | null;
};

type CourseOption = {
  id: number;
  courseCode: string;
  courseTitle: string;
  credit: number;
  courseType: string;
  levelTerm: string | null;
  groupName: string | null;
};

type RoomOption = {
  id: number;
  roomCode: string;
  roomType: string;
  capacity: number | null;
};

type TeacherOption = {
  id: number;
  teacherCode: string;
  fullName: string;
  designation: string | null;
  seniorityLevel: number | null;
  departmentCode: string;
  displayLabel: string;
};

type ExistingOfferingOption = {
  id: number;
  status: string;
  programCode: string;
  programName: string;
  createdAt: string | null;
  recommended: boolean;
};

type SlotForm = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomId: string;
  slotType: string;
};

type AvailabilitySlot = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  batchCodes?: string[];
  courseCode: string;
  courseTitle: string;
  section: string;
  facultyText?: string;
};

type ManualRow = {
  offeredCourseId: number;
  offeringId: number;
  offeringStatus: string;
  programCode: string;
  isManualAddition: boolean;
  masterCourseId: number;
  courseCode: string;
  courseTitle: string;
  section: string;
  credit: number;
  batchIds: number[];
  batchCodes: string[];
  teacherId: number | null;
  loadType: string;
  facultyText: string;
  slots: Array<{
    id: number;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    roomId: number;
    roomCode: string;
    slotType: string;
  }>;
  scheduleText: string;
};

type OptionsResponse = {
  success?: boolean;
  error?: string;
  terms?: TermOption[];
  programs?: ProgramOption[];
  batches?: BatchOption[];
  courses?: CourseOption[];
  rooms?: RoomOption[];
  teachers?: TeacherOption[];
  existingOfferings?: ExistingOfferingOption[];
  recommendedOfferingId?: number | null;
};

type AvailabilityResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  occupiedBatchSlots?: AvailabilitySlot[];
  teacherOccupiedSlots?: AvailabilitySlot[];
  suggestedOpenWindows?: Array<{
    dayOfWeek: string;
    warning: string;
  }>;
};

type AddBatchResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  batches?: BatchOption[];
};

const DAY_OPTIONS = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

const SLOT_TYPES = ["CLASS", "LAB", "PROJECT", "OTHER"];
const LOAD_TYPES = ["MANUAL", "PREASSIGNED", "OVERRIDE"];

function isProjectLikeCourse(course?: CourseOption | null) {
  if (!course) return false;

  const code = String(course.courseCode || "").replace(/\s+/g, "").toUpperCase();
  const title = String(course.courseTitle || "").toUpperCase();
  const type = String(course.courseType || "").toUpperCase();

  return (
    ["EEE4139", "EEE4239", "EEE4339"].includes(code) ||
    title.includes("PROJECT") ||
    title.includes("FYDP") ||
    title.includes("THESIS") ||
    title.includes("INTERNSHIP") ||
    title.includes("VIVA") ||
    type.includes("PROJECT") ||
    type.includes("THESIS") ||
    type.includes("INTERNSHIP") ||
    type.includes("VIVA")
  );
}

function createEmptySlot(): SlotForm {
  return {
    dayOfWeek: "SATURDAY",
    startTime: "09:00",
    endTime: "10:30",
    roomId: "",
    slotType: "CLASS",
  };
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function hasOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);

  if (aS === null || aE === null || bS === null || bE === null) return false;
  return aS < bE && bS < aE;
}

function normalizeRoomCode(value: string) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

export default function ManualOfferingPageClient() {
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [existingOfferings, setExistingOfferings] = useState<
    ExistingOfferingOption[]
  >([]);

  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    null
  );

  const [termName, setTermName] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [targetOfferingId, setTargetOfferingId] = useState("");
  const [precreateCoOfferPrimaryId, setPrecreateCoOfferPrimaryId] =
    useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [masterCourseId, setMasterCourseId] = useState("");
  const [section, setSection] = useState("1");
  const [teacherId, setTeacherId] = useState("");
  const [loadType, setLoadType] = useState("MANUAL");
  const [slots, setSlots] = useState<SlotForm[]>([createEmptySlot()]);

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingManualRows, setLoadingManualRows] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addBatchCourseId, setAddBatchCourseId] = useState<number | null>(null);
  const [addBatchOptions, setAddBatchOptions] = useState<BatchOption[]>([]);
  const [addBatchId, setAddBatchId] = useState("");
  const [loadingAddBatch, setLoadingAddBatch] = useState(false);
  const [savingAddBatch, setSavingAddBatch] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === masterCourseId) || null,
    [courses, masterCourseId]
  );

  const selectedOffering = useMemo(
    () =>
      existingOfferings.find(
        (offering) => String(offering.id) === targetOfferingId
      ) || null,
    [existingOfferings, targetOfferingId]
  );

  const selectedRoomById = useMemo(() => {
    const map = new Map<string, RoomOption>();
    rooms.forEach((room) => map.set(String(room.id), room));
    return map;
  }, [rooms]);

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => String(teacher.id) === teacherId) || null,
    [teachers, teacherId]
  );

  const slotOptional = isProjectLikeCourse(selectedCourse);

  const localSlotWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (!availability) return warnings;

    for (const slot of slots) {
      if (!slot.dayOfWeek || !slot.startTime || !slot.endTime) continue;

      const batchConflict = (availability.occupiedBatchSlots || []).find(
        (busy) =>
          busy.dayOfWeek === slot.dayOfWeek &&
          hasOverlap(slot.startTime, slot.endTime, busy.startTime, busy.endTime)
      );

      if (batchConflict) {
        warnings.push(
          `Batch conflict${batchConflict.batchCodes?.length ? ` for ${batchConflict.batchCodes.join(", ")}` : ""}: ${batchConflict.dayOfWeek} ${batchConflict.startTime}-${batchConflict.endTime} already has ${batchConflict.courseCode} Sec-${batchConflict.section}.`
        );
      }

      const room = selectedRoomById.get(slot.roomId);
      const roomConflict = (availability.occupiedBatchSlots || []).find(
        (busy) =>
          room &&
          normalizeRoomCode(busy.roomCode) === normalizeRoomCode(room.roomCode) &&
          busy.dayOfWeek === slot.dayOfWeek &&
          hasOverlap(slot.startTime, slot.endTime, busy.startTime, busy.endTime)
      );

      if (roomConflict) {
        warnings.push(
          `Room warning from batch schedule: ${room?.roomCode} is already used by ${roomConflict.courseCode} at ${roomConflict.dayOfWeek} ${roomConflict.startTime}-${roomConflict.endTime}.`
        );
      }

      const teacherConflict = (availability.teacherOccupiedSlots || []).find(
        (busy) =>
          busy.dayOfWeek === slot.dayOfWeek &&
          hasOverlap(slot.startTime, slot.endTime, busy.startTime, busy.endTime)
      );

      if (teacherConflict && selectedTeacher) {
        warnings.push(
          `Faculty warning: ${selectedTeacher.teacherCode} already has ${teacherConflict.courseCode} Sec-${teacherConflict.section} at ${teacherConflict.dayOfWeek} ${teacherConflict.startTime}-${teacherConflict.endTime}.`
        );
      }
    }

    return Array.from(new Set(warnings));
  }, [availability, selectedRoomById, selectedTeacher, slots]);

  async function loadOptions(
    nextProgramCode = programCode,
    nextTermName = termName,
    nextBatchIds = batchIds
  ) {
    setLoadingOptions(true);
    setError("");

    try {
      const qs = new URLSearchParams();
      if (nextProgramCode) qs.set("programCode", nextProgramCode);
      if (nextTermName) qs.set("termName", nextTermName);
      if (nextBatchIds.length > 0) {
        qs.set("batchIds", nextBatchIds.join(","));
      }

      const res = await fetch(
        `/api/admin/manual-offering/options?${qs.toString()}`,
        {
          cache: "no-store",
        }
      );

      const json: OptionsResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load manual offering options.");
      }

      setTerms(json.terms || []);
      setPrograms(json.programs || []);
      setBatches(json.batches || []);
      setCourses(json.courses || []);
      setRooms(json.rooms || []);
      setTeachers(json.teachers || []);
      setExistingOfferings(json.existingOfferings || []);

      if (!termName && json.terms?.length) {
        setTermName(json.terms[0].name);
      }

      if (json.recommendedOfferingId) {
        setTargetOfferingId(String(json.recommendedOfferingId));
      } else if (json.existingOfferings?.length) {
        setTargetOfferingId(String(json.existingOfferings[0].id));
      } else {
        setTargetOfferingId("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load options.");
    } finally {
      setLoadingOptions(false);
    }
  }

  async function loadAvailability() {
    if (!termName || batchIds.length === 0) {
      setAvailability(null);
      return;
    }

    setLoadingAvailability(true);

    try {
      const qs = new URLSearchParams({
        termName,
        batchIds: batchIds.join(","),
      });

      if (teacherId) qs.set("teacherId", teacherId);
      if (editingId !== null) {
        qs.set("excludeOfferedCourseId", String(editingId));
      }

      const res = await fetch(
        `/api/admin/manual-offering/availability?${qs.toString()}`,
        { cache: "no-store" }
      );

      const json: AvailabilityResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load availability.");
      }

      setAvailability(json);
    } catch (err) {
      setAvailability({
        error: err instanceof Error ? err.message : "Failed to load availability.",
      });
    } finally {
      setLoadingAvailability(false);
    }
  }

  async function loadManualRows() {
    if (!termName) {
      setManualRows([]);
      return;
    }

    setLoadingManualRows(true);

    try {
      const qs = new URLSearchParams({ termName });
      if (programCode) qs.set("programCode", programCode);

      const res = await fetch(`/api/admin/manual-offering/list?${qs.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load manual rows.");
      }

      setManualRows(json.rows || []);
    } catch {
      setManualRows([]);
    } finally {
      setLoadingManualRows(false);
    }
  }

  useEffect(() => {
    loadOptions("", "", []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setBatchIds([]);
    setMasterCourseId("");
    setTargetOfferingId("");
    setAvailability(null);
    setAddBatchCourseId(null);
    setAddBatchOptions([]);
    setAddBatchId("");

    if (programCode || termName) {
      loadOptions(programCode, termName, []);
    }

    if (termName) {
      loadManualRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programCode, termName]);

  useEffect(() => {
    if (editingId === null) {
      setMasterCourseId("");
    }

    if (programCode && termName && batchIds.length > 0) {
      loadOptions(programCode, termName, batchIds);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termName, batchIds.join(",")]);

  useEffect(() => {
    loadAvailability();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termName, batchIds.join(","), teacherId, editingId]);

  function updateSlot(index: number, key: keyof SlotForm, value: string) {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [key]: value } : slot))
    );
  }

  function addSlot() {
    setSlots((prev) => [...prev, createEmptySlot()]);
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function startEdit(row: ManualRow) {
    if (!row.isManualAddition) {
      setError("Only manual additions can be edited from this correction tool.");
      return;
    }

    if (row.offeringStatus === "CONFIRMED") {
      setError("Confirmed offerings are locked and cannot be edited.");
      return;
    }

    if (!row.batchIds.length) {
      setError(
        "This offered course does not have a batch link and cannot be edited here."
      );
      return;
    }

    setEditingId(row.offeredCourseId);
    setTargetOfferingId(String(row.offeringId));
    setBatchIds(row.batchIds.map((id) => String(id)));
    setMasterCourseId(String(row.masterCourseId));
    setSection(row.section);
    setTeacherId(row.teacherId === null ? "" : String(row.teacherId));
    setLoadType(row.loadType || "MANUAL");

    setSlots(
      row.slots.length
        ? row.slots.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            roomId: String(slot.roomId),
            slotType: slot.slotType || "CLASS",
          }))
        : [createEmptySlot()]
    );

    setError("");
    setMessage(
      `Editing ${row.courseCode} Sec-${row.section} in offering #${row.offeringId}.`
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setBatchIds([]);
    setMasterCourseId("");
    setSection("1");
    setTeacherId("");
    setLoadType("MANUAL");
    setSlots([createEmptySlot()]);
    setAvailability(null);
    setError("");
    setMessage("");
  }

  async function startAddBatch(row: ManualRow) {
    if (!row.isManualAddition) {
      setError("Only manual additions can receive another batch here.");
      return;
    }

    if (row.offeringStatus === "CONFIRMED") {
      setError("Confirmed offerings are locked and cannot receive another batch.");
      return;
    }

    if (!programCode) {
      setError("Select the academic program first, then use Add Batch.");
      return;
    }

    setLoadingAddBatch(true);
    setAddBatchCourseId(row.offeredCourseId);
    setAddBatchOptions([]);
    setAddBatchId("");
    setMessage("");
    setError("");

    try {
      const qs = new URLSearchParams({
        offeredCourseId: String(row.offeredCourseId),
        programCode,
      });

      const res = await fetch(
        `/api/admin/manual-offering/add-batch?${qs.toString()}`,
        { cache: "no-store" }
      );

      const json: AddBatchResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load eligible batches.");
      }

      setAddBatchOptions(json.batches || []);

      if (!json.batches?.length) {
        setMessage(
          `No additional eligible batch is available for ${row.courseCode} Sec-${row.section}.`
        );
      }
    } catch (err) {
      setAddBatchCourseId(null);
      setError(
        err instanceof Error ? err.message : "Failed to load eligible batches."
      );
    } finally {
      setLoadingAddBatch(false);
    }
  }

  function cancelAddBatch() {
    setAddBatchCourseId(null);
    setAddBatchOptions([]);
    setAddBatchId("");
  }

  async function handleAddBatch(row: ManualRow) {
    if (!addBatchId) {
      setError("Select a batch to add.");
      return;
    }

    if (!programCode) {
      setError("Select the academic program first.");
      return;
    }

    setSavingAddBatch(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/manual-offering/add-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offeredCourseId: row.offeredCourseId,
          programCode,
          batchId: addBatchId,
        }),
      });

      const json: AddBatchResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to add batch.");
      }

      setMessage(json.message || "Batch added successfully.");
      cancelAddBatch();
      await Promise.all([loadManualRows(), loadAvailability()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add batch.");
    } finally {
      setSavingAddBatch(false);
    }
  }

  async function handleDelete(offeredCourseId: number) {
    const yes = window.confirm(
      "Delete this manually added offered course? This removes its slots, batch link, and teacher assignment."
    );

    if (!yes) return;

    setDeletingId(offeredCourseId);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `/api/admin/manual-offering/delete?offeredCourseId=${offeredCourseId}`,
        { method: "DELETE" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete manual offered course.");
      }

      setMessage(json.message || "Manual offered course deleted.");
      await Promise.all([loadManualRows(), loadAvailability()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete manual offered course."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const isEditing = editingId !== null;

      const payload = {
        ...(isEditing
          ? {
              offeredCourseId: editingId,
            }
          : {}),
        termName,
        programCode,
        targetOfferingId: targetOfferingId || null,
        coOfferPrimaryOfferedCourseId:
          !isEditing && precreateCoOfferPrimaryId
            ? precreateCoOfferPrimaryId
            : null,
        batchIds,
        masterCourseId,
        section,
        teacherId: teacherId || null,
        loadType,
        slots: slotOptional ? slots.filter((slot) => slot.roomId) : slots,
      };

      const res = await fetch(
        isEditing
          ? "/api/admin/manual-offering/update"
          : "/api/admin/manual-offering/create",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to add manual offered course.");
      }

      setMessage(
        json.message ||
          (editingId !== null
            ? "Manual offered course updated successfully."
            : "Manual offered course added successfully.")
      );
      setPrecreateCoOfferPrimaryId("");
      setEditingId(null);
      setBatchIds([]);
      setMasterCourseId("");
      setSection("1");
      setTeacherId("");
      setLoadType("MANUAL");
      setSlots([createEmptySlot()]);
      await Promise.all([
        loadOptions(programCode, termName),
        loadAvailability(),
        loadManualRows(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add manual offered course."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          {editingId !== null
            ? "Edit Manual Offered Course"
            : "Add Manual Offered Course"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {editingId !== null
            ? "Update the course, section, faculty assignment, load type, room, day, or time before the offering becomes confirmed. Batch links are managed separately with Add Batch."
            : "Offer the course to one batch first. After saving, use Add Batch on the row below when another batch should attend the same section and schedule."}
        </p>

        {editingId !== null ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-semibold">
              Edit mode is active for offered course #{editingId}.
            </div>
            <div className="mt-1">
              Saving will update the existing offered-course record rather than create
              another course.
            </div>
          </div>
        ) : null}

        {existingOfferings.length ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Existing offering found. Select the correct target below. Recommended:
            <span className="ml-1 font-semibold">
              {existingOfferings.find((item) => item.recommended)
                ? `#${existingOfferings.find((item) => item.recommended)?.id}`
                : "none"}
            </span>
          </div>
        ) : programCode && termName ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No existing offering found for this program and term. The system will
            create one in <span className="font-semibold">FACULTY_CHOICE_BUFFER</span>{" "}
            status when saving.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Academic Term
              </label>
              <select
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full rounded-xl border px-3 py-3 text-sm"
                required
              >
                <option value="">Select Term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.name}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Program
              </label>
              <select
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
                className="w-full rounded-xl border px-3 py-3 text-sm"
                required
              >
                <option value="">Select Program</option>
                {programs.map((program) => (
                  <option
                    key={`${program.programCode}-${program.id}`}
                    value={program.programCode}
                  >
                    {program.displayLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Target Offering
              </label>
              <select
                value={targetOfferingId}
                onChange={(e) => setTargetOfferingId(e.target.value)}
                className="w-full rounded-xl border px-3 py-3 text-sm"
                disabled={!programCode || !termName || loadingOptions}
              >
                <option value="">Auto-create / Auto-select</option>
                {existingOfferings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    #{offering.id} | {offering.status} | {offering.programCode}
                    {offering.recommended ? " | Recommended" : ""}
                  </option>
                ))}
              </select>
              {selectedOffering?.status === "CONFIRMED" ? (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  Confirmed offerings are locked. Select a non-confirmed offering.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Batch
              </label>
              <select
                value={batchIds[0] || ""}
                onChange={(e) =>
                  setBatchIds(e.target.value ? [e.target.value] : [])
                }
                className="w-full rounded-xl border px-3 py-3 text-sm"
                disabled={!programCode || loadingOptions || editingId !== null}
                required
              >
                <option value="">Select Batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchCode}
                    {batch.admissionTerm ? ` | ${batch.admissionTerm}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {editingId !== null
                  ? "Existing batch links are preserved during Edit. Use Add Batch from the saved row to attach another batch."
                  : "Offer this section to one batch first. You can attach more batches after saving."}
              </p>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Course
              </label>
              <select
                value={masterCourseId}
                onChange={(e) => setMasterCourseId(e.target.value)}
                className="w-full rounded-xl border px-3 py-3 text-sm"
                disabled={!programCode || loadingOptions}
                required
              >
                <option value="">Select Course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.courseCode} - {course.courseTitle} ({course.credit} cr)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCourse && editingId === null ? (
            <PrecreateManualCoOffer
              termName={termName}
              currentProgramCode={programCode}
              courseCode={selectedCourse.courseCode}
              courseTitle={selectedCourse.courseTitle}
              credit={selectedCourse.credit}
              programs={programs}
              value={precreateCoOfferPrimaryId}
              onChange={setPrecreateCoOfferPrimaryId}
            />
          ) : null}

          {batchIds.length > 0 && !precreateCoOfferPrimaryId ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-bold text-amber-900">
                    Availability warning for selected batch(es)
                  </h3>
                  <p className="mt-1 text-sm text-amber-800">
                    {loadingAvailability
                      ? "Checking occupied slots..."
                      : availability?.message ||
                        "Review existing class times before selecting a new slot."}
                  </p>
                </div>
              </div>

              {availability?.suggestedOpenWindows?.length ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {availability.suggestedOpenWindows.map((item) => (
                    <div
                      key={item.dayOfWeek}
                      className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900"
                    >
                      <span className="font-semibold">{item.dayOfWeek}: </span>
                      {item.warning}
                    </div>
                  ))}
                </div>
              ) : null}

              {availability?.occupiedBatchSlots?.length ? (
                <div className="mt-4 overflow-x-auto rounded-2xl border bg-white">
                  <table className="min-w-full text-xs">
                    <thead className="bg-amber-100">
                      <tr>
                        <th className="border-b px-3 py-2 text-left">Day</th>
                        <th className="border-b px-3 py-2 text-left">Time</th>
                        <th className="border-b px-3 py-2 text-left">Room</th>
                        <th className="border-b px-3 py-2 text-left">Course</th>
                        <th className="border-b px-3 py-2 text-left">Faculty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availability.occupiedBatchSlots.map((slot, index) => (
                        <tr key={`${slot.courseCode}-${index}`}>
                          <td className="border-b px-3 py-2">{slot.dayOfWeek}</td>
                          <td className="border-b px-3 py-2">
                            {slot.startTime}-{slot.endTime}
                          </td>
                          <td className="border-b px-3 py-2">{slot.roomCode}</td>
                          <td className="border-b px-3 py-2">
                            {slot.courseCode} Sec-{slot.section}
                          </td>
                          <td className="border-b px-3 py-2">
                            {slot.facultyText || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {localSlotWarnings.length ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div className="font-bold">Current slot warning:</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {localSlotWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Section
              </label>
              <input
                value={section}
                onChange={(e) => setSection(e.target.value.toUpperCase())}
                className="w-full rounded-xl border px-3 py-3 text-sm"
                placeholder="1"
                required
              />
            </div>

            {!precreateCoOfferPrimaryId ? (
              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Faculty Assignment Optional
                </label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full rounded-xl border px-3 py-3 text-sm"
                >
                  <option value="">No faculty now</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.displayLabel}
                      {teacher.seniorityLevel
                        ? ` | Level ${teacher.seniorityLevel}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {selectedCourse ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">
            {selectedCourse.courseCode} - {selectedCourse.courseTitle}
              </div>
              <div className="mt-1">
                Credit: {selectedCourse.credit} | Type: {selectedCourse.courseType} |
                Level/Term: {selectedCourse.levelTerm || "-"}
              </div>
              {precreateCoOfferPrimaryId ? (
                <div className="mt-2 font-semibold text-emerald-700">
                  Co-offered secondary course. Schedule, room and faculty are inherited from the selected primary course.
                </div>
              ) : slotOptional ? (
                <div className="mt-2 font-semibold text-emerald-700">
                  Slot optional course detected. You may save without slots.
                </div>
              ) : (
                <div className="mt-2 font-semibold text-blue-700">
                  This course requires at least one valid class/lab slot.
                </div>
              )}
            </div>
          ) : null}

          {!precreateCoOfferPrimaryId ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Load Type
              </label>
              <select
                value={loadType}
                onChange={(e) => setLoadType(e.target.value)}
                className="w-full rounded-xl border px-3 py-3 text-sm"
              >
                {LOAD_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!precreateCoOfferPrimaryId ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Optional / Required Slots
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Warnings are shown before saving; server-side conflict checks still
                  block invalid room conflicts.
                </p>
              </div>

              <button
                type="button"
                onClick={addSlot}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Add Slot
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {slots.map((slot, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-6"
                >
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Day
                    </label>
                    <select
                      value={slot.dayOfWeek}
                      onChange={(e) =>
                        updateSlot(index, "dayOfWeek", e.target.value)
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                    >
                      {DAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Start
                    </label>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) =>
                        updateSlot(index, "startTime", e.target.value)
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      End
                    </label>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) =>
                        updateSlot(index, "endTime", e.target.value)
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Room
                    </label>
                    <select
                      value={slot.roomId}
                      onChange={(e) =>
                        updateSlot(index, "roomId", e.target.value)
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                    >
                      <option value="">No room</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.roomCode} | {room.roomType}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Slot Type
                    </label>
                    <select
                      value={slot.slotType}
                      onChange={(e) =>
                        updateSlot(index, "slotType", e.target.value)
                      }
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                    >
                      {SLOT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeSlot(index)}
                      disabled={slots.length === 1}
                      className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={
                submitting ||
                !termName ||
                !programCode ||
                batchIds.length === 0 ||
                !masterCourseId ||
                !section ||
                selectedOffering?.status === "CONFIRMED"
              }
              className={`rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 ${
                editingId !== null
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              {submitting
                ? "Saving..."
                : editingId !== null
                  ? "Save Changes"
                  : "Add Manual Offered Course"}
            </button>

            {editingId !== null ? (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={submitting}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Manual Additions for Selected Term
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Edit the saved section, attach another eligible batch to the same
              class and schedule, or delete it before the offering becomes CONFIRMED.
            </p>
          </div>

          <button
            type="button"
            onClick={loadManualRows}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {loadingManualRows ? "Loading..." : "Refresh List"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Offering</th>
                <th className="border-b px-3 py-3 text-left">Program</th>
                <th className="border-b px-3 py-3 text-left">Batch</th>
                <th className="border-b px-3 py-3 text-left">Course</th>
                <th className="border-b px-3 py-3 text-left">Section</th>
                <th className="border-b px-3 py-3 text-left">Faculty</th>
                <th className="border-b px-3 py-3 text-left">Schedule</th>
                <th className="border-b px-3 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {manualRows.map((row) => (
                <tr key={row.offeredCourseId}>
                  <td className="border-b px-3 py-2">
                    #{row.offeringId}
                    <br />
                    <span className="text-xs text-slate-500">
                      {row.offeringStatus}
                    </span>
                  </td>
                  <td className="border-b px-3 py-2">{row.programCode}</td>
                  <td className="border-b px-3 py-2">
                    {row.batchCodes.join(", ") || "-"}
                  </td>
                  <td className="border-b px-3 py-2">
                    <span className="font-semibold">{row.courseCode}</span>
                    <br />
                    <span className="text-xs text-slate-500">
                      {row.courseTitle}
                    </span>
                  </td>
                  <td className="border-b px-3 py-2">{row.section}</td>
                  <td className="border-b px-3 py-2">{row.facultyText}</td>
                  <td className="border-b px-3 py-2">{row.scheduleText}</td>
                  <td className="border-b px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          !row.isManualAddition ||
                          row.offeringStatus === "CONFIRMED" ||
                          submitting ||
                          deletingId !== null
                        }
                        onClick={() => startEdit(row)}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          !row.isManualAddition
                            ? "Only manual additions can be edited here."
                            : row.offeringStatus === "CONFIRMED"
                              ? "Confirmed offerings are locked."
                              : "Edit this manual offered course."
                        }
                      >
                        {editingId === row.offeredCourseId ? "Editing" : "Edit"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          !row.isManualAddition ||
                          row.offeringStatus === "CONFIRMED" ||
                          submitting ||
                          deletingId !== null ||
                          savingAddBatch
                        }
                        onClick={() => startAddBatch(row)}
                        className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Attach another eligible batch to this same course section and schedule."
                      >
                        {loadingAddBatch && addBatchCourseId === row.offeredCourseId
                          ? "Loading..."
                          : "Add Batch"}
                      </button>

                      <button
                        type="button"
                        disabled={
                          !row.isManualAddition ||
                          deletingId === row.offeredCourseId ||
                          row.offeringStatus === "CONFIRMED" ||
                          submitting
                        }
                        onClick={() => handleDelete(row.offeredCourseId)}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          !row.isManualAddition
                            ? "Only manual additions can be deleted here."
                            : row.offeringStatus === "CONFIRMED"
                              ? "Confirmed offerings are locked."
                              : "Delete this manual offered course."
                        }
                      >
                        {deletingId === row.offeredCourseId
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>

                    {addBatchCourseId === row.offeredCourseId ? (
                      <div className="mt-3 min-w-64 rounded-xl border border-violet-200 bg-violet-50 p-3">
                        <div className="text-xs font-semibold text-violet-900">
                          Add another batch to {row.courseCode} Sec-{row.section}
                        </div>

                        <select
                          value={addBatchId}
                          onChange={(e) => setAddBatchId(e.target.value)}
                          disabled={loadingAddBatch || savingAddBatch}
                          className="mt-2 w-full rounded-lg border bg-white px-2 py-2 text-xs"
                        >
                          <option value="">Select eligible batch</option>
                          {addBatchOptions.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.batchCode}
                              {batch.admissionTerm
                                ? ` | ${batch.admissionTerm}`
                                : ""}
                            </option>
                          ))}
                        </select>

                        {!loadingAddBatch && !addBatchOptions.length ? (
                          <div className="mt-2 text-xs text-slate-600">
                            No additional eligible batch is available.
                          </div>
                        ) : null}

                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddBatch(row)}
                            disabled={
                              savingAddBatch ||
                              loadingAddBatch ||
                              !addBatchId
                            }
                            className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                          >
                            {savingAddBatch ? "Checking..." : "Attach Batch"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelAddBatch}
                            disabled={savingAddBatch}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>

                        <p className="mt-2 text-[11px] leading-4 text-violet-800">
                          The system checks course eligibility and schedule conflicts
                          for the new batch before creating the batch link.
                        </p>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}

              {!manualRows.length ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No manual additions found for selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

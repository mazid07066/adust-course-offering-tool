"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type Candidate = {
  primaryId: number;
  secondaryId: number;
  primaryLabel: string;
  secondaryLabel: string;
  score: number;
  reason: string;
};

type Offering = {
  offeringId: number;
  programCode: string;
  programName: string;
  status: string;
  courseCount: number;
};

type CourseOption = {
  id: number;
  offeringId: number;
  programCode: string;
  programName: string;
  offeringStatus: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  credit: number;
  primaryOfferedCourseId: number | null;
  isCooffered: boolean;
  linkedPrimaryLabel: string;
  secondaryCount: number;
  slotCount: number;
  teacherCount: number;
  batchCodes: string[];
};

type BatchOption = {
  id: number;
  batchCode: string;
  programCode: string;
  isAttached?: boolean;
  isUsedInThisOffering?: boolean;
  hasConflict?: boolean;
  conflictReason?: string;
  isInactive?: boolean;
  isProgramMismatch?: boolean;
  warning?: string;
};

type BatchEditorCourse = {
  id: number;
  programCode: string;
  programName: string;
  termName: string;
  offeringStatus: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  isSecondary: boolean;
  primaryLabel: string;
};

export default function Page() {
  const [termName, setTermName] = useState("SUMMER 2026");

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [primaryProgram, setPrimaryProgram] = useState("BSC-EEE-REG-NEW");
  const [secondaryProgram, setSecondaryProgram] = useState("BSC-RAE-REG-NEW");

  const [primaryCourseId, setPrimaryCourseId] = useState("");
  const [secondaryCourseId, setSecondaryCourseId] = useState("");

  const [batchEditCourseId, setBatchEditCourseId] = useState("");
  const [batchEditorCourse, setBatchEditorCourse] =
    useState<BatchEditorCourse | null>(null);
  const [availableBatches, setAvailableBatches] = useState<BatchOption[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [loadingBatchEditor, setLoadingBatchEditor] = useState(false);
  const [savingBatches, setSavingBatches] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resettingOfferingId, setResettingOfferingId] = useState<number | null>(
    null
  );

  const programOptions = useMemo(() => {
    return Array.from(new Set(offerings.map((item) => item.programCode))).sort();
  }, [offerings]);

  const primaryCourses = useMemo(() => {
    return courses
      .filter((course) => course.programCode === primaryProgram)
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  }, [courses, primaryProgram]);

  const secondaryCourses = useMemo(() => {
    return courses
      .filter((course) => course.programCode === secondaryProgram)
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  }, [courses, secondaryProgram]);

  const selectedPrimary = useMemo(() => {
    return primaryCourses.find((course) => String(course.id) === primaryCourseId);
  }, [primaryCourses, primaryCourseId]);

  const selectedSecondary = useMemo(() => {
    return secondaryCourses.find(
      (course) => String(course.id) === secondaryCourseId
    );
  }, [secondaryCourses, secondaryCourseId]);

  const batchEditCourses = useMemo(() => {
    return courses
      .filter((course) => course.programCode === secondaryProgram)
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  }, [courses, secondaryProgram]);

  async function load() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const qs = new URLSearchParams({ termName });

      const res = await fetch(
        `/api/admin/co-offering-decision/candidates?${qs.toString()}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load co-offering data.");
      }

      setOfferings(json.diagnostics?.matchedOfferings || []);
      setCourses(json.courses || []);
      setCandidates(json.candidates || []);

      if ((json.candidates || []).length === 0) {
        setMessage("No auto candidates found. Use manual linking.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load co-offering data."
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetConfirmedOffering(offeringId: number, label: string) {
    const ok = window.confirm(
      `Reset ${label} from CONFIRMED to FACULTY_CHOICE_FINALIZED?\n\nThis will allow co-offering and batch edits again. You must re-confirm it later from Final Schedule Control.`
    );

    if (!ok) return;

    setResettingOfferingId(offeringId);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        "/api/admin/co-offering-decision/reset-confirmed",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offeringId }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to reset offering.");
      }

      setMessage(json.message || "Offering reset successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset offering.");
    } finally {
      setResettingOfferingId(null);
    }
  }

  async function manualLink() {
    if (!primaryCourseId || !secondaryCourseId) {
      setError("Select both primary and secondary courses.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/co-offering-decision/manual-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryOfferedCourseId: Number(primaryCourseId),
          secondaryOfferedCourseId: Number(secondaryCourseId),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to link courses.");
      }

      setMessage(json.message || "Linked successfully.");
      setPrimaryCourseId("");
      setSecondaryCourseId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link courses.");
    }
  }

  async function unlinkCourse(id: number) {
    const ok = window.confirm("Unlink/reset this co-offered course?");
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/co-offering-decision/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offeredCourseId: id }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to unlink course.");
      }

      setMessage(json.message || "Unlinked successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink course.");
    }
  }

  async function loadBatchEditor(courseId: string) {
    setBatchEditCourseId(courseId);
    setBatchEditorCourse(null);
    setAvailableBatches([]);
    setSelectedBatchIds([]);

    if (!courseId) return;

    setLoadingBatchEditor(true);
    setError("");
    setMessage("");

    try {
      const qs = new URLSearchParams({ offeredCourseId: courseId });

      const res = await fetch(
        `/api/admin/co-offering-decision/course-batches/options?${qs.toString()}`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load batch editor.");
      }

      setBatchEditorCourse(json.course || null);
      setAvailableBatches(json.availableBatches || []);
      setSelectedBatchIds(
        Array.isArray(json.attachedBatchIds)
          ? json.attachedBatchIds.map((item: unknown) => Number(item))
          : []
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch editor.");
    } finally {
      setLoadingBatchEditor(false);
    }
  }

  function toggleBatch(batchId: number) {
    setSelectedBatchIds((prev) =>
      prev.includes(batchId)
        ? prev.filter((item) => item !== batchId)
        : [...prev, batchId].sort((a, b) => a - b)
    );
  }

  async function saveBatchLinks() {
    if (!batchEditCourseId) {
      setError("Select a course first.");
      return;
    }

    if (selectedBatchIds.length === 0) {
      setError("Select at least one batch.");
      return;
    }

    const conflictingSelections = availableBatches.filter(
      (batch) => selectedBatchIds.includes(batch.id) && batch.hasConflict
    );

    if (conflictingSelections.length > 0) {
      const proceed = window.confirm(
        `WARNING:\n\nSome selected batches have schedule conflicts.\n\n` +
          conflictingSelections
            .map(
              (b) =>
                `${b.batchCode} -> ${b.conflictReason || "Conflict detected"}`
            )
            .join("\n\n") +
          `\n\nDo you still want to continue? The server will still block unsafe conflicts.`
      );

      if (!proceed) return;
    }

    setSavingBatches(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        offeredCourseId: Number(batchEditCourseId),
        batchIds: selectedBatchIds,
      };

      const res = await fetch(
        "/api/admin/co-offering-decision/course-batches/update",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update batches.");
      }

      setMessage(json.message || "Batch list updated.");
      await load();
      await loadBatchEditor(batchEditCourseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update batches.");
    } finally {
      setSavingBatches(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout title="Co-offering Decision Center">
      <div className="space-y-6">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Co-offering Decision Center</h2>

          <div className="mt-4 flex flex-wrap gap-3">
            <input
              value={termName}
              onChange={(e) => setTermName(e.target.value.toUpperCase())}
              className="rounded-xl border px-4 py-3"
            />

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>
        </section>

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

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold">Offering Status / Reset</h3>

          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Offering</th>
                  <th className="border-b px-3 py-3 text-left">Program</th>
                  <th className="border-b px-3 py-3 text-left">Status</th>
                  <th className="border-b px-3 py-3 text-left">Courses</th>
                  <th className="border-b px-3 py-3 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {offerings.map((offering) => (
                  <tr key={offering.offeringId}>
                    <td className="border-b px-3 py-2">#{offering.offeringId}</td>
                    <td className="border-b px-3 py-2">{offering.programCode}</td>
                    <td className="border-b px-3 py-2">
                      <span
                        className={
                          offering.status === "CONFIRMED"
                            ? "rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                            : "rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700"
                        }
                      >
                        {offering.status}
                      </span>
                    </td>
                    <td className="border-b px-3 py-2">{offering.courseCount}</td>
                    <td className="border-b px-3 py-2">
                      {offering.status === "CONFIRMED" ? (
                        <button
                          type="button"
                          onClick={() =>
                            resetConfirmedOffering(
                              offering.offeringId,
                              `${offering.programCode} #${offering.offeringId}`
                            )
                          }
                          disabled={resettingOfferingId === offering.offeringId}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {resettingOfferingId === offering.offeringId
                            ? "Resetting..."
                            : "Reset to Editable"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">Editable</span>
                      )}
                    </td>
                  </tr>
                ))}

                {offerings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      No offerings loaded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold">Manual Course Linking</h3>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Primary Program</label>
              <select
                value={primaryProgram}
                onChange={(e) => {
                  setPrimaryProgram(e.target.value);
                  setPrimaryCourseId("");
                }}
                className="w-full rounded-xl border px-4 py-3"
              >
                {programOptions.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>

              <label className="mb-2 mt-4 block text-sm font-medium">
                Primary Course
              </label>
              <select
                value={primaryCourseId}
                onChange={(e) => setPrimaryCourseId(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">Select primary course</option>
                {primaryCourses.map((course) => (
                  <option
                    key={course.id}
                    value={course.id}
                    disabled={
                      course.offeringStatus === "CONFIRMED" ||
                      Boolean(course.primaryOfferedCourseId)
                    }
                  >
                    {course.courseCode} Sec-{course.section} |{" "}
                    {course.courseTitle} | {course.offeringStatus}
                  </option>
                ))}
              </select>

              {selectedPrimary ? (
                <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-sm">
                  <div>
                    <b>Credit:</b> {selectedPrimary.credit}
                  </div>
                  <div>
                    <b>Batches:</b> {selectedPrimary.batchCodes?.join(", ") || "-"}
                  </div>
                  <div>
                    <b>Own slots:</b> {selectedPrimary.slotCount}
                  </div>
                  <div>
                    <b>Faculty rows:</b> {selectedPrimary.teacherCount}
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Secondary Program
              </label>
              <select
                value={secondaryProgram}
                onChange={(e) => {
                  setSecondaryProgram(e.target.value);
                  setSecondaryCourseId("");
                }}
                className="w-full rounded-xl border px-4 py-3"
              >
                {programOptions.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>

              <label className="mb-2 mt-4 block text-sm font-medium">
                Secondary Course
              </label>
              <select
                value={secondaryCourseId}
                onChange={(e) => setSecondaryCourseId(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">Select secondary course</option>
                {secondaryCourses.map((course) => (
                  <option
                    key={course.id}
                    value={course.id}
                    disabled={course.offeringStatus === "CONFIRMED"}
                  >
                    {course.courseCode} Sec-{course.section} |{" "}
                    {course.courseTitle} | {course.offeringStatus}
                    {course.primaryOfferedCourseId
                      ? ` | Linked to ${course.linkedPrimaryLabel}`
                      : ""}
                  </option>
                ))}
              </select>

              {selectedSecondary ? (
                <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-sm">
                  <div>
                    <b>Credit:</b> {selectedSecondary.credit}
                  </div>
                  <div>
                    <b>Batches:</b>{" "}
                    {selectedSecondary.batchCodes?.join(", ") || "-"}
                  </div>
                  <div>
                    <b>Own slots:</b> {selectedSecondary.slotCount}
                  </div>
                  <div>
                    <b>Faculty rows:</b> {selectedSecondary.teacherCount}
                  </div>
                  <div>
                    <b>Linked:</b>{" "}
                    {selectedSecondary.primaryOfferedCourseId
                      ? selectedSecondary.linkedPrimaryLabel
                      : "No"}
                  </div>

                  {selectedSecondary.primaryOfferedCourseId ? (
                    <button
                      type="button"
                      onClick={() => unlinkCourse(selectedSecondary.id)}
                      className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Unlink This Course
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={manualLink}
            disabled={!primaryCourseId || !secondaryCourseId}
            className="mt-5 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            Link Courses
          </button>
        </section>

        <section className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold">Course Batch Control</h3>
          <p className="mb-4 text-sm text-slate-600">
            Shows all batches under the selected program and all batches already used
            in this offering workflow. Attached, inactive, conflict, and mismatch batches are clearly marked.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Program for Batch Editing
              </label>
              <select
                value={secondaryProgram}
                onChange={(e) => {
                  setSecondaryProgram(e.target.value);
                  setSecondaryCourseId("");
                  setBatchEditCourseId("");
                  setBatchEditorCourse(null);
                  setAvailableBatches([]);
                  setSelectedBatchIds([]);
                }}
                className="w-full rounded-xl border px-4 py-3"
              >
                {programOptions.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>

              <label className="mb-2 mt-4 block text-sm font-medium">
                Course to Edit Batches
              </label>
              <select
                value={batchEditCourseId}
                onChange={(e) => void loadBatchEditor(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="">Select course</option>
                {batchEditCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.courseCode} Sec-{course.section} |{" "}
                    {course.courseTitle} | {course.offeringStatus}
                    {course.primaryOfferedCourseId
                      ? ` | Secondary linked to ${course.linkedPrimaryLabel}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-4 text-sm">
              {loadingBatchEditor ? (
                <div>Loading batch editor...</div>
              ) : batchEditorCourse ? (
                <div className="space-y-1">
                  <div>
                    <b>Selected:</b> {batchEditorCourse.programCode} |{" "}
                    {batchEditorCourse.courseCode} Sec-{batchEditorCourse.section}
                  </div>
                  <div>
                    <b>Title:</b> {batchEditorCourse.courseTitle}
                  </div>
                  <div>
                    <b>Status:</b> {batchEditorCourse.offeringStatus}
                  </div>
                  <div>
                    <b>Co-offer role:</b>{" "}
                    {batchEditorCourse.isSecondary
                      ? `Secondary, inherits ${batchEditorCourse.primaryLabel}`
                      : "Primary / independent"}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500">Select a course to edit batches.</div>
              )}
            </div>
          </div>

          {batchEditorCourse ? (
            <div className="mt-5">
              <h4 className="mb-3 font-semibold">All Batches</h4>

              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                {availableBatches.map((batch) => {
                  const isSelected = selectedBatchIds.includes(batch.id);

                  let cardClass =
                    "cursor-pointer rounded-xl border p-3 text-sm transition-all";

                  if (isSelected) {
                    cardClass +=
                      " border-blue-400 bg-blue-50 text-blue-900 shadow-sm";
                  } else {
                    cardClass += " bg-white hover:bg-slate-50";
                  }

                  if (batch.hasConflict) {
                    cardClass += " border-red-300";
                  }

                  if (batch.isInactive) {
                    cardClass += " opacity-50";
                  }

                  return (
                    <label key={batch.id} className={cardClass}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleBatch(batch.id)}
                            />

                            <span className="font-semibold">
                              {batch.batchCode}
                            </span>
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {batch.programCode}
                          </div>

                          {batch.isAttached ? (
                            <div className="mt-2 inline-block rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700">
                              CURRENTLY ATTACHED
                            </div>
                          ) : null}

                          {batch.isUsedInThisOffering ? (
                            <div className="mt-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">
                              USED IN OFFERING
                            </div>
                          ) : null}

                          {batch.hasConflict ? (
                            <div className="mt-2 rounded-lg bg-red-50 px-2 py-2 text-[11px] text-red-700">
                              Conflict detected
                              <br />
                              {batch.conflictReason}
                            </div>
                          ) : null}

                          {batch.isProgramMismatch ? (
                            <div className="mt-2 rounded-lg bg-amber-50 px-2 py-2 text-[11px] text-amber-700">
                              Program mismatch
                              <br />
                              {batch.warning}
                            </div>
                          ) : null}

                          {batch.isInactive ? (
                            <div className="mt-2 inline-block rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600">
                              INACTIVE
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border bg-slate-50 p-4">
                <div className="mb-2 text-sm font-semibold">
                  Selected batches ({selectedBatchIds.length})
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedBatchIds.length ? (
                    selectedBatchIds.map((id) => {
                      const batch = availableBatches.find((item) => item.id === id);

                      return (
                        <div
                          key={id}
                          className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800"
                        >
                          {batch
                            ? `${batch.batchCode} (${batch.programCode})`
                            : `Batch ID ${id}`}
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-sm text-slate-500">
                      No batch selected
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={saveBatchLinks}
                disabled={
                  savingBatches ||
                  batchEditorCourse.offeringStatus === "CONFIRMED" ||
                  selectedBatchIds.length === 0
                }
                className="mt-4 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingBatches
                  ? "Saving Batch Configuration..."
                  : batchEditorCourse.offeringStatus === "CONFIRMED"
                    ? "Reset Offering First"
                    : `Save ${selectedBatchIds.length} Batch Selection${
                        selectedBatchIds.length > 1 ? "s" : ""
                      }`}
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold">Auto Suggestions</h3>

          {candidates.map((candidate) => (
            <div
              key={`${candidate.primaryId}-${candidate.secondaryId}`}
              className="mb-2 rounded-xl border p-3 text-sm"
            >
              <div>{candidate.primaryLabel}</div>
              <div className="text-slate-500">↔ {candidate.secondaryLabel}</div>
              <div className="text-xs text-slate-400">
                Score: {candidate.score} | {candidate.reason}
              </div>
            </div>
          ))}

          {candidates.length === 0 ? (
            <div className="rounded-xl border bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No automatic suggestions. Use manual linking above.
            </div>
          ) : null}
        </section>
      </div>
    </AdminLayout>
  );
}
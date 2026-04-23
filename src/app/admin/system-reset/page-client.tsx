"use client";

import { useState } from "react";

type ResetSummary = {
  facultySelections?: number;
  manualCooffers?: number;
  offeredTeachers?: number;
  offeredSlots?: number;
  offeredBatches?: number;
  offeredCourses?: number;
  offerings?: number;
};

export default function SystemResetPageClient() {
  const [operationalConfirmation, setOperationalConfirmation] = useState("");
  const [fullConfirmation, setFullConfirmation] = useState("");

  const [operationalLoading, setOperationalLoading] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);

  const [operationalMessage, setOperationalMessage] = useState("");
  const [fullMessage, setFullMessage] = useState("");

  const [operationalError, setOperationalError] = useState("");
  const [fullError, setFullError] = useState("");

  const [operationalSummary, setOperationalSummary] = useState<ResetSummary | null>(null);

  async function handleOperationalReset() {
    setOperationalLoading(true);
    setOperationalMessage("");
    setOperationalError("");
    setOperationalSummary(null);

    try {
      const res = await fetch("/api/admin/reset-operational-data", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Operational reset failed.");
      }

      setOperationalMessage(
        data.message || "Operational offering data reset completed."
      );
      setOperationalSummary(data.summary || null);
      setOperationalConfirmation("");
    } catch (err) {
      setOperationalError(
        err instanceof Error ? err.message : "Operational reset failed."
      );
    } finally {
      setOperationalLoading(false);
    }
  }

  async function handleFullReset() {
    setFullLoading(true);
    setFullMessage("");
    setFullError("");

    try {
      const res = await fetch("/api/admin/reset-system", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Full reset failed.");
      }

      setFullMessage(data.message || "System reset completed.");
      setFullConfirmation("");
    } catch (err) {
      setFullError(err instanceof Error ? err.message : "Full reset failed.");
    } finally {
      setFullLoading(false);
    }
  }

  const canOperationalReset =
    operationalConfirmation.trim() === "RESET OPERATIONAL DATA";

  const canFullReset = fullConfirmation.trim() === "RESET ADUST";

  return (
    <div className="max-w-5xl space-y-6">
      <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-emerald-700">
          Production Prep Reset (Recommended)
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-700">
          This reset clears only operational offering workflow data so you can
          launch cleanly without losing your setup foundation.
        </p>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">This reset will remove:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Draft and confirmed offerings</li>
            <li>Offered course rows</li>
            <li>Attached batches</li>
            <li>Slots and rooms inside offerings</li>
            <li>Assigned teachers inside offerings</li>
            <li>Faculty course choice rows</li>
            <li>Manual co-offered export/reference rows</li>
          </ul>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-slate-800">This reset keeps:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Academic setup</li>
            <li>Master course imports</li>
            <li>Transcript and registration imports</li>
            <li>Users and faculty profiles</li>
            <li>Rooms</li>
            <li>Academic terms</li>
          </ul>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-slate-800">
            Type{" "}
            <span className="rounded bg-slate-100 px-2 py-1 font-mono">
              RESET OPERATIONAL DATA
            </span>{" "}
            to confirm
          </label>

          <input
            value={operationalConfirmation}
            onChange={(e) => setOperationalConfirmation(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Type RESET OPERATIONAL DATA"
          />
        </div>

        <button
          type="button"
          onClick={handleOperationalReset}
          disabled={!canOperationalReset || operationalLoading}
          className="mt-6 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {operationalLoading
            ? "Resetting operational data..."
            : "Reset Operational Offering Data"}
        </button>

        {operationalMessage ? (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            {operationalMessage}
          </p>
        ) : null}

        {operationalError ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {operationalError}
          </p>
        ) : null}

        {operationalSummary ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Deleted rows summary</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                faculty_course_selections:{" "}
                <span className="font-semibold">{operationalSummary.facultySelections ?? 0}</span>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                offered_course_manual_cooffers:{" "}
                <span className="font-semibold">{operationalSummary.manualCooffers ?? 0}</span>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                offered_course_teachers:{" "}
                <span className="font-semibold">{operationalSummary.offeredTeachers ?? 0}</span>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                offered_course_slots:{" "}
                <span className="font-semibold">{operationalSummary.offeredSlots ?? 0}</span>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                offered_course_batches:{" "}
                <span className="font-semibold">{operationalSummary.offeredBatches ?? 0}</span>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                offered_courses:{" "}
                <span className="font-semibold">{operationalSummary.offeredCourses ?? 0}</span>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                offerings:{" "}
                <span className="font-semibold">{operationalSummary.offerings ?? 0}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-red-700">Full Destructive Reset</h2>

        <p className="mt-3 text-sm leading-7 text-slate-700">
          This action is for deep development cleanup only. It removes much more
          than operational data. Use it only when you truly want a fresh rebuild.
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-slate-800">
            Type <span className="rounded bg-slate-100 px-2 py-1 font-mono">RESET ADUST</span> to confirm
          </label>

          <input
            value={fullConfirmation}
            onChange={(e) => setFullConfirmation(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Type RESET ADUST"
          />
        </div>

        <button
          type="button"
          onClick={handleFullReset}
          disabled={!canFullReset || fullLoading}
          className="mt-6 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {fullLoading ? "Resetting..." : "Reset System Data Fully"}
        </button>

        {fullMessage ? (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            {fullMessage}
          </p>
        ) : null}

        {fullError ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {fullError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
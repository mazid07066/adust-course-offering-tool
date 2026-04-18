"use client";

import { useState } from "react";

export default function SystemResetPageClient() {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleReset() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/reset-system", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Reset failed.");
      }

      setMessage(data.message || "System reset completed.");
      setConfirmation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  const canReset = confirmation.trim() === "RESET ADUST";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-red-700">Fresh Setup Reset Control</h2>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          This action will remove previous academic setup, courses, batches, imports, offerings,
          rooms, faculties, academic terms, and report logs. User accounts remain untouched.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          Use this once now if you want a completely clean environment before final structured
          setup and testing.
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-slate-800">
            Type <span className="rounded bg-slate-100 px-2 py-1 font-mono">RESET ADUST</span> to confirm
          </label>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Type RESET ADUST"
          />
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={!canReset || loading}
          className="mt-6 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Resetting..." : "Reset System Data"}
        </button>

        {message ? (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
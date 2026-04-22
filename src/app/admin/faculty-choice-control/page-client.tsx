"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type LevelPolicy = {
  level: number;
  minCredits: number | null;
  maxCredits: number | null;
};

export default function PageClient() {
  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [warningMinutes, setWarningMinutes] = useState(10);
  const [windowStatus, setWindowStatus] = useState("CLOSED");
  const [activeSeniorityLevel, setActiveSeniorityLevel] = useState("");
  const [activeTeacherId, setActiveTeacherId] = useState("");
  const [autoAdvanceOnExpiry, setAutoAdvanceOnExpiry] = useState("true");
  const [levelPolicies, setLevelPolicies] = useState<LevelPolicy[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<
    Array<{ id: number; teacher_code: string; full_name: string; seniority_level: number | null }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings();
    loadFaculties();
  }, []);

      async function loadSettings() {
    setError("");
    try {
      const res = await fetch("/api/system-settings", { cache: "no-store" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(data.error || "Failed to load settings.");
      }

      setSessionMinutes(data.sessionMinutes ?? 30);
      setWarningMinutes(data.warningMinutes ?? 10);
      setWindowStatus(data.windowStatus ?? "CLOSED");
      setActiveSeniorityLevel(
        data.activeSeniorityLevel === null || data.activeSeniorityLevel === undefined
          ? ""
          : String(data.activeSeniorityLevel)
      );
      setActiveTeacherId(
        data.activeTeacherId === null || data.activeTeacherId === undefined
          ? ""
          : String(data.activeTeacherId)
      );
      setAutoAdvanceOnExpiry(String(data.autoAdvanceOnExpiry ?? true));
      setLevelPolicies(
        Array.isArray(data.levelCreditPolicies)
          ? data.levelCreditPolicies
          : [1, 2, 3, 4, 5, 6, 7].map((level) => ({
              level,
              minCredits: null,
              maxCredits: null,
            }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    }
  }

  async function loadFaculties() {
    try {
      const res = await fetch("/api/faculties/manage", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) return;

      const rows = Array.isArray(json.faculties) ? json.faculties : [];
      setFacultyOptions(
        rows.map((row: any) => ({
          id: row.id,
          teacher_code: row.teacher_code,
          full_name: row.full_name,
          seniority_level: row.seniority_level ?? null,
        }))
      );
    } catch {
      // keep silent
    }
  }

  async function updateSetting(key: string, value: string | number) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/system-settings/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, value }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update setting.");
      }

      await loadSettings();
      setMessage("Setting updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setting.");
    } finally {
      setLoading(false);
    }
  }

  async function saveLevelPolicy(level: number, minCredits: number | null, maxCredits: number | null) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/system-settings/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "FACULTY_LEVEL_CREDIT_POLICY",
          level,
          minCredits,
          maxCredits,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save level credit policy.");
      }

      await loadSettings();
      setMessage(`Level ${level} credit policy saved successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save level credit policy.");
    } finally {
      setLoading(false);
    }
  }

  function updateLocalLevelPolicy(
    level: number,
    field: "minCredits" | "maxCredits",
    rawValue: string
  ) {
    setLevelPolicies((prev) =>
      prev.map((item) =>
        item.level === level
          ? {
              ...item,
              [field]: rawValue === "" ? null : Number(rawValue),
            }
          : item
      )
    );
  }

  return (
    <AdminLayout title="Faculty Choice Control">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">
            Faculty Choice Control Panel
          </h1>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div>
              All faculty may log in and view the open pool, but only the currently active faculty turn may edit and finalize.
            </div>
            <div>
              Faculty visibility still depends on offering stages
              <span className="mx-1 font-semibold">FACULTY_CHOICE_BUFFER</span>
              and
              <span className="mx-1 font-semibold">FACULTY_CHOICE_FINALIZED</span>.
            </div>
          </div>
        </div>

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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-medium text-slate-900">
            Session Timing
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Session Duration Minutes
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  min={1}
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(Number(e.target.value))}
                  className="w-40 rounded-xl border px-3 py-2"
                />
                <button
                  onClick={() =>
                    updateSetting("FACULTY_SESSION_MINUTES", sessionMinutes)
                  }
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={loading}
                >
                  Save
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Warning Threshold Minutes
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  min={1}
                  value={warningMinutes}
                  onChange={(e) => setWarningMinutes(Number(e.target.value))}
                  className="w-40 rounded-xl border px-3 py-2"
                />
                <button
                  onClick={() =>
                    updateSetting("FACULTY_WARNING_MINUTES", warningMinutes)
                  }
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={loading}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-medium text-slate-900">
            Faculty Choice Window
          </h2>

          <div className="flex flex-wrap gap-3">
            {["OPEN", "CLOSED", "FINAL_LOCKED"].map((item) => (
              <button
                key={item}
                onClick={() =>
                  updateSetting("FACULTY_CHOICE_WINDOW_STATUS", item)
                }
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  windowStatus === item
                    ? item === "OPEN"
                      ? "bg-green-600 text-white"
                      : item === "FINAL_LOCKED"
                      ? "bg-red-600 text-white"
                      : "bg-amber-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
                disabled={loading}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-medium text-slate-900">
            Active Seniority Phase
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Active Seniority Level
              </label>
              <div className="flex gap-3">
                <select
                  value={activeSeniorityLevel}
                  onChange={(e) => setActiveSeniorityLevel(e.target.value)}
                  className="w-52 rounded-xl border px-3 py-2"
                >
                  <option value="">All Levels</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((level) => (
                    <option key={level} value={String(level)}>
                      Level {level}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() =>
                    updateSetting(
                      "FACULTY_ACTIVE_SENIORITY_LEVEL",
                      activeSeniorityLevel
                    )
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  disabled={loading}
                >
                  Save
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Active Faculty Turn
              </label>
              <div className="flex gap-3">
                <select
                  value={activeTeacherId}
                  onChange={(e) => setActiveTeacherId(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                >
                  <option value="">None Selected</option>
                  {facultyOptions.map((faculty) => (
                    <option key={faculty.id} value={String(faculty.id)}>
                      {faculty.teacher_code} — {faculty.full_name} | Level {faculty.seniority_level ?? "-"}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() =>
                    updateSetting("FACULTY_ACTIVE_TEACHER_ID", activeTeacherId)
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  disabled={loading}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Auto Advance On Expiry
            </label>
            <div className="flex gap-3">
              <select
                value={autoAdvanceOnExpiry}
                onChange={(e) => setAutoAdvanceOnExpiry(e.target.value)}
                className="w-40 rounded-xl border px-3 py-2"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>

              <button
                onClick={() =>
                  updateSetting(
                    "FACULTY_AUTO_ADVANCE_ON_EXPIRY",
                    autoAdvanceOnExpiry
                  )
                }
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={loading}
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">
            Seniority Level Credit Rules
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Define optional minimum and maximum allowed credits for faculty levels 1 to 7.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Level</th>
                  <th className="border-b px-3 py-3 text-left">Min Credits</th>
                  <th className="border-b px-3 py-3 text-left">Max Credits</th>
                  <th className="border-b px-3 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {levelPolicies.map((policy) => (
                  <tr key={policy.level}>
                    <td className="border-b px-3 py-2 font-medium">
                      Level {policy.level}
                    </td>
                    <td className="border-b px-3 py-2">
                      <input
                        type="number"
                        value={policy.minCredits ?? ""}
                        onChange={(e) =>
                          updateLocalLevelPolicy(
                            policy.level,
                            "minCredits",
                            e.target.value
                          )
                        }
                        className="w-32 rounded-xl border px-3 py-2"
                        min={0}
                      />
                    </td>
                    <td className="border-b px-3 py-2">
                      <input
                        type="number"
                        value={policy.maxCredits ?? ""}
                        onChange={(e) =>
                          updateLocalLevelPolicy(
                            policy.level,
                            "maxCredits",
                            e.target.value
                          )
                        }
                        className="w-32 rounded-xl border px-3 py-2"
                        min={0}
                      />
                    </td>
                    <td className="border-b px-3 py-2">
                      <button
                        onClick={() =>
                          saveLevelPolicy(
                            policy.level,
                            policy.minCredits,
                            policy.maxCredits
                          )
                        }
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        disabled={loading}
                      >
                        Save Level {policy.level}
                      </button>
                    </td>
                  </tr>
                ))}

                {levelPolicies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No level policies loaded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
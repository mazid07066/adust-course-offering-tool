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
  const [windowStatus, setWindowStatus] = useState("CLOSED");
  const [levelPolicies, setLevelPolicies] = useState<LevelPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setError("");
    try {
      const res = await fetch("/api/system-settings", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load settings.");
      }

      setSessionMinutes(data.sessionMinutes ?? 30);
      setWindowStatus(data.windowStatus ?? "CLOSED");
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
      setError(
        err instanceof Error ? err.message : "Failed to save level credit policy."
      );
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
              [field]:
                rawValue === "" ? null : Number(rawValue),
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
              Faculty should only see offerings when they are explicitly moved into
              <span className="mx-1 font-semibold">FACULTY_CHOICE_BUFFER</span>
              or
              <span className="mx-1 font-semibold">FACULTY_CHOICE_FINALIZED</span>.
            </div>
            <div>
              <span className="font-medium">Current Window Status:</span>{" "}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {windowStatus}
              </span>
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
            Faculty Session Duration
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              value={sessionMinutes}
              onChange={(e) => setSessionMinutes(Number(e.target.value))}
              className="w-40 rounded-xl border px-3 py-2"
              min={1}
            />

            <button
              onClick={() =>
                updateSetting("FACULTY_SESSION_MINUTES", sessionMinutes)
              }
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={loading}
            >
              Save Session Duration
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-medium text-slate-900">
            Faculty Choice Window
          </h2>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() =>
                updateSetting("FACULTY_CHOICE_WINDOW_STATUS", "OPEN")
              }
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                windowStatus === "OPEN"
                  ? "bg-green-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
              disabled={loading}
            >
              OPEN
            </button>

            <button
              onClick={() =>
                updateSetting("FACULTY_CHOICE_WINDOW_STATUS", "CLOSED")
              }
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                windowStatus === "CLOSED"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
              disabled={loading}
            >
              CLOSED
            </button>

            <button
              onClick={() =>
                updateSetting("FACULTY_CHOICE_WINDOW_STATUS", "FINAL_LOCKED")
              }
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                windowStatus === "FINAL_LOCKED"
                  ? "bg-red-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
              disabled={loading}
            >
              FINAL_LOCKED
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">
            Seniority Level Credit Rules
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Define optional minimum and maximum allowed credits for faculty levels 1 to 7.
            Leave blank if a level should not have a fixed minimum or maximum yet.
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
                      No level policy rows loaded.
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
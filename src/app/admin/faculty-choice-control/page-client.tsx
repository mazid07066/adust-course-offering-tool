"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type LevelPolicy = {
  level: number;
  minCredits: number | null;
  maxCredits: number | null;
};

type ProgramOption = {
  code: string;
  label: string;
};

const SENIORITY_LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function PageClient() {
  const { terms, termName, setTermName, loadingTerms } = useAcademicTerms();

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programCode, setProgramCode] = useState("");
  const [scopeMode, setScopeMode] = useState<"PROGRAM" | "ALL">("PROGRAM");

  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [warningMinutes, setWarningMinutes] = useState(10);
  const [windowStatus, setWindowStatus] = useState("CLOSED");
  const [autoAdvanceOnExpiry, setAutoAdvanceOnExpiry] = useState("true");
  const [levelPolicies, setLevelPolicies] = useState<LevelPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings();
    loadPrograms();
  }, []);

  async function loadPrograms() {
    try {
      const res = await fetch("/api/academic-catalog/options", {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) return;

      const rows = Array.isArray(json.programs) ? json.programs : [];
      const mapped = rows.map((row: any) => ({
        code: row.programCode,
        label: row.displayLabel || row.programCode,
      }));

      setPrograms(mapped);

      if (mapped.length > 0) {
        setProgramCode((prev) => prev || mapped[0].code);
      }
    } catch {
      // keep silent
    }
  }

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
      setAutoAdvanceOnExpiry(String(data.autoAdvanceOnExpiry ?? true));
      setLevelPolicies(
        Array.isArray(data.levelCreditPolicies)
          ? data.levelCreditPolicies
          : SENIORITY_LEVELS.map((level) => ({
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

  async function saveLevelPolicy(
    level: number,
    minCredits: number | null,
    maxCredits: number | null
  ) {
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
              [field]: rawValue === "" ? null : Number(rawValue),
            }
          : item
      )
    );
  }

  async function openFacultyChoice() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/faculty-choice/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termName,
          mode: scopeMode,
          programCode,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to open faculty choice.");
      }

      setMessage(json.message || "Faculty choice opened successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open faculty choice."
      );
    } finally {
      setLoading(false);
    }
  }

  async function closeFacultyChoice() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/faculty-choice/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termName,
          mode: scopeMode,
          programCode,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to close faculty choice.");
      }

      setMessage(json.message || "Faculty choice closed successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to close faculty choice."
      );
    } finally {
      setLoading(false);
    }
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
              Draft publish only moves offerings to{" "}
              <span className="font-semibold">BUFFER_READY</span>.
            </div>
            <div>
              Faculty only see offerings in{" "}
              <span className="font-semibold">FACULTY_CHOICE_BUFFER</span> or{" "}
              <span className="font-semibold">FACULTY_CHOICE_FINALIZED</span>.
            </div>
            <div>
              Use the controls below to open one selected program or all programs
              for the selected term.
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">
            Open / Close Faculty Choice by Term
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Academic Term
              </label>
              <select
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                disabled={loadingTerms}
              >
                <option value="">
                  {loadingTerms ? "Loading terms..." : "Select Academic Term"}
                </option>
                {terms.map((term) => (
                  <option key={term.name} value={term.name}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Scope
              </label>
              <select
                value={scopeMode}
                onChange={(e) => setScopeMode(e.target.value as "PROGRAM" | "ALL")}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="PROGRAM">Selected Program Only</option>
                <option value="ALL">All Programs in Term</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Program
              </label>
              <select
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                disabled={scopeMode === "ALL"}
              >
                <option value="">Select Program</option>
                {programs.map((program) => (
                  <option key={program.code} value={program.code}>
                    {program.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={openFacultyChoice}
              disabled={loading || !termName || (scopeMode === "PROGRAM" && !programCode)}
              className="rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              Open for Faculty Choice
            </button>

            <button
              onClick={closeFacultyChoice}
              disabled={loading || !termName || (scopeMode === "PROGRAM" && !programCode)}
              className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              Close into Faculty Choice Finalized
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Session Timing</h2>

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
            Auto Advance On Expiry
          </h2>

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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-medium text-slate-900">
            Seniority Level Credit Rules
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Define optional minimum and maximum allowed credits for faculty levels
            1 to 20.
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
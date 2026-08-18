"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type AcademicTerm = {
  id: number;
  name: string;
  year: number;
  term_type: string;
  is_active: boolean | null;
  is_current: boolean;
};

type ControlResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  settings?: {
    enabled: boolean;
    academicTermId: number | null;
  };
  selectedTerm?: AcademicTerm | null;
  terms?: AcademicTerm[];
};

export default function PageClient() {
  const [terms, setTerms] = useState<AcademicTerm[]>(
    []
  );

  const [enabled, setEnabled] = useState(false);
  const [academicTermId, setAcademicTermId] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedTerm = useMemo(
    () =>
      terms.find(
        (term) =>
          String(term.id) === academicTermId
      ) ?? null,
    [terms, academicTermId]
  );

  async function loadControl() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        "/api/admin/public-schedule-control",
        {
          cache: "no-store",
        }
      );

      const json: ControlResponse =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json.error ||
            "Failed to load public schedule control."
        );
      }

      setTerms(
        Array.isArray(json.terms)
          ? json.terms
          : []
      );

      setEnabled(
        Boolean(json.settings?.enabled)
      );

      setAcademicTermId(
        json.settings?.academicTermId
          ? String(
              json.settings.academicTermId
            )
          : ""
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load public schedule control."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveControl() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        "/api/admin/public-schedule-control",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            enabled,
            academicTermId:
              academicTermId || null,
          }),
        }
      );

      const json: ControlResponse =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json.error ||
            "Failed to save public schedule control."
        );
      }

      setMessage(
        json.message ||
          "Public schedule control updated."
      );

      await loadControl();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save public schedule control."
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadControl();
  }, []);

  return (
    <AdminLayout title="Public Schedule Control">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                Scheduling & Publication
              </p>

              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                Public Schedule Release
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Select the single academic
                semester that should be visible
                through the public student and
                faculty schedule pages. Previous
                semesters remain available inside
                administrative reports but will
                not be exposed publicly after the
                public schedule APIs are locked to
                this release setting.
              </p>
            </div>

            <div
              className={`rounded-2xl border px-5 py-4 text-sm ${
                enabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-[0.16em]">
                Publication Status
              </div>

              <div className="mt-1 text-lg font-bold">
                {enabled
                  ? "OPEN"
                  : "CLOSED"}
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">
            Release Configuration
          </h3>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Published Academic Term
              </label>

              <select
                value={academicTermId}
                onChange={(event) =>
                  setAcademicTermId(
                    event.target.value
                  )
                }
                disabled={loading || saving}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">
                  Select academic term
                </option>

                {terms.map((term) => (
                  <option
                    key={term.id}
                    value={term.id}
                  >
                    {term.name}
                    {term.is_current
                      ? " — Current"
                      : ""}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Example: select FALL 2026 when
                the Fall 2026 semester becomes
                the official public semester.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Public Access
              </label>

              <button
                type="button"
                onClick={() =>
                  setEnabled((current) => !current)
                }
                disabled={loading || saving}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                  enabled
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-300 bg-slate-50"
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {enabled
                      ? "Public Schedule Open"
                      : "Public Schedule Closed"}
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {enabled
                      ? "Student and faculty public schedule publication is enabled."
                      : "Public schedule publication is disabled."}
                  </div>
                </div>

                <div
                  className={`relative h-7 w-12 rounded-full transition ${
                    enabled
                      ? "bg-emerald-600"
                      : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                      enabled
                        ? "left-6"
                        : "left-1"
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Current Release
            </div>

            <div className="mt-2 text-xl font-bold text-slate-950">
              {selectedTerm?.name ||
                "No academic term selected"}
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {enabled
                ? selectedTerm
                  ? `${selectedTerm.name} is configured as the public semester.`
                  : "Public access cannot be opened until an academic term is selected."
                : "The public schedule is currently closed."}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void saveControl()
              }
              disabled={
                loading ||
                saving ||
                (enabled &&
                  !academicTermId)
              }
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving
                ? "Saving..."
                : "Save Public Release"}
            </button>

            <button
              type="button"
              onClick={() =>
                void loadControl()
              }
              disabled={loading || saving}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-bold text-amber-950">
            Publication Safety
          </h3>

          <p className="mt-2 text-sm leading-6 text-amber-900">
            This control does not change,
            confirm, archive, or modify any
            offering. It only determines which
            academic term is permitted to be
            exposed through the public schedule
            interfaces.
          </p>
        </section>
      </div>
    </AdminLayout>
  );
}

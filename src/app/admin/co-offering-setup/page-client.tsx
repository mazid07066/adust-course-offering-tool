"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminLayout from "@/components/admin-layout";
import ProgramTermSelector from "@/components/program-term-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type ManualCooffer = {
  id: number;
  target_program_code: string | null;
  manual_course_code: string;
  note: string | null;
};

type SectionOption = {
  id: number;
  label: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  programCode: string;
  batchCodes: string[];
  hasOwnSlots?: boolean;
  hasOwnTeachers?: boolean;
  recommended?: boolean;
  manualCooffers?: ManualCooffer[];
};

type ExistingLink = {
  primaryOfferedCourseId: number;
  primaryLabel: string;
  secondaryOfferedCourseId: number;
  secondaryLabel: string;
  primaryBatchCodes: string[];
  secondaryBatchCodes: string[];
};

type OptionsResponse = {
  ok?: boolean;
  error?: string;
  termName: string;
  primarySections: SectionOption[];
  secondarySections: SectionOption[];
  existingLinks: ExistingLink[];
};

export default function CoOfferingSetupPageClient() {
  const searchParams = useSearchParams();

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

  const [secondaryProgramCode, setSecondaryProgramCode] = useState("");
  const [primaryOfferedCourseId, setPrimaryOfferedCourseId] = useState("");
  const [secondaryOfferedCourseId, setSecondaryOfferedCourseId] = useState("");

  const [manualTargetProgramCode, setManualTargetProgramCode] = useState("");
  const [manualCourseCode, setManualCourseCode] = useState("");
  const [manualNote, setManualNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [deletingManualId, setDeletingManualId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [primarySections, setPrimarySections] = useState<SectionOption[]>([]);
  const [secondarySections, setSecondarySections] = useState<SectionOption[]>([]);
  const [existingLinks, setExistingLinks] = useState<ExistingLink[]>([]);

  const requestedProgramCode = searchParams.get("primaryProgramCode") || "";
  const requestedTermName = searchParams.get("termName") || "";
  const requestedPrimaryOfferedCourseId =
    searchParams.get("primaryOfferedCourseId") || "";

  useEffect(() => {
    if (requestedProgramCode) {
      setProgramCode(requestedProgramCode);
    }
    if (requestedTermName) {
      setTermName(requestedTermName);
    }
  }, [requestedProgramCode, requestedTermName, setProgramCode, setTermName]);

  const combinedError = error || programError || termError;

  const secondaryProgramOptions = useMemo(() => {
    return programs.map((item, index) => ({
      value: item.programCode,
      label: item.displayLabel,
      key: `${item.programCode}-${index}`,
    }));
  }, [programs]);

  const selectedPrimarySection = useMemo(() => {
    return primarySections.find(
      (item) => String(item.id) === String(primaryOfferedCourseId)
    ) || null;
  }, [primarySections, primaryOfferedCourseId]);

  async function loadOptions(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!termName || !programCode || !secondaryProgramCode) {
      setError(
        "Please select term, primary academic identity, and secondary academic identity."
      );
      setMessage("");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const params = new URLSearchParams({
        termName,
        primaryProgramCode: programCode,
        secondaryProgramCode,
      });

      const res = await fetch(`/api/co-offering/options?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: OptionsResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load co-offering options.");
      }

      setPrimarySections(json.primarySections || []);
      setSecondarySections(json.secondarySections || []);
      setExistingLinks(json.existingLinks || []);

      if (requestedPrimaryOfferedCourseId) {
        const found = (json.primarySections || []).find(
          (item) => String(item.id) === requestedPrimaryOfferedCourseId
        );
        if (found) {
          setPrimaryOfferedCourseId(String(found.id));
        }
      }
    } catch (err) {
      setPrimarySections([]);
      setSecondarySections([]);
      setExistingLinks([]);
      setError(
        err instanceof Error ? err.message : "Failed to load co-offering options."
      );
    } finally {
      setLoading(false);
    }
  }

  async function createLink() {
    if (!primaryOfferedCourseId || !secondaryOfferedCourseId) {
      setError("Please select both primary and secondary sections.");
      setMessage("");
      return;
    }

    setLinking(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/co-offering/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryOfferedCourseId: Number(primaryOfferedCourseId),
          secondaryOfferedCourseId: Number(secondaryOfferedCourseId),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create co-offering link.");
      }

      setMessage("Co-offering link created successfully.");
      setSecondaryOfferedCourseId("");
      await loadOptions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create co-offering link."
      );
    } finally {
      setLinking(false);
    }
  }

  async function unlinkSection(secondaryId: number) {
    const ok = window.confirm("Remove this co-offering link?");
    if (!ok) return;

    setUnlinkingId(secondaryId);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/co-offering/unlink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secondaryOfferedCourseId: secondaryId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to remove co-offering link.");
      }

      setMessage("Co-offering link removed successfully.");
      await loadOptions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove co-offering link."
      );
    } finally {
      setUnlinkingId(null);
    }
  }

  async function addManualCooffer() {
    if (!primaryOfferedCourseId) {
      setError("Please select a primary draft section first.");
      setMessage("");
      return;
    }

    if (!manualCourseCode.trim()) {
      setError("Please enter a manual co-offered course code.");
      setMessage("");
      return;
    }

    setSavingManual(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/co-offering/manual/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offeredCourseId: Number(primaryOfferedCourseId),
          targetProgramCode: manualTargetProgramCode || null,
          manualCourseCode,
          note: manualNote,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to add manual co-offered code.");
      }

      setManualTargetProgramCode("");
      setManualCourseCode("");
      setManualNote("");
      setMessage("Manual co-offered code added successfully.");
      await loadOptions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add manual co-offered code."
      );
    } finally {
      setSavingManual(false);
    }
  }

  async function deleteManualCooffer(manualCoofferId: number) {
    const ok = window.confirm("Remove this manual co-offered course code?");
    if (!ok) return;

    setDeletingManualId(manualCoofferId);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/co-offering/manual/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manualCoofferId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to remove manual co-offered code.");
      }

      setMessage("Manual co-offered code removed successfully.");
      await loadOptions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove manual co-offered code."
      );
    } finally {
      setDeletingManualId(null);
    }
  }

  return (
    <AdminLayout title="Co-offering Setup">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Co-offering Setup
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Use drafted section linking for true co-offering. Use manual course
            code entry for old or exceptional co-offered codes that are not
            present as active drafted sections.
          </p>
        </div>

        <form onSubmit={loadOptions} className="space-y-4">
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

          <div className="max-w-xl">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Secondary Academic Identity
            </label>
            <select
              value={secondaryProgramCode}
              onChange={(e) => {
                setSecondaryProgramCode(e.target.value);
                setPrimaryOfferedCourseId("");
                setSecondaryOfferedCourseId("");
                setPrimarySections([]);
                setSecondarySections([]);
                setExistingLinks([]);
              }}
              className="w-full rounded-xl border px-4 py-3"
            >
              <option value="">Select secondary academic identity</option>
              {secondaryProgramOptions.map((item) => (
                <option key={item.key} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || !termName || !programCode || !secondaryProgramCode}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Co-offering Workspace"}
            </button>
          </div>
        </form>

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

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">
              Link Existing Drafted Sections
            </h4>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Primary Draft Section
                </label>
                <select
                  value={primaryOfferedCourseId}
                  onChange={(e) => setPrimaryOfferedCourseId(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="">Select primary section</option>
                  {primarySections.map((item) => (
                    <option key={`primary-${item.id}`} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Secondary Draft Section
                </label>
                <select
                  value={secondaryOfferedCourseId}
                  onChange={(e) => setSecondaryOfferedCourseId(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="">Select secondary section</option>
                  {secondarySections.map((item) => (
                    <option key={`secondary-${item.id}`} value={item.id}>
                      {item.recommended ? `★ ${item.label}` : item.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={createLink}
                disabled={linking || !primaryOfferedCourseId || !secondaryOfferedCourseId}
                className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {linking ? "Linking..." : "Confirm Co-offering Link"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">
              Manual Co-offered Course Code
            </h4>

            <p className="mt-2 text-sm text-slate-500">
              Use this when a co-offered code must be kept for export, review, or
              old-curriculum reference, but there is no current drafted section to link.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Primary Draft Section
                </label>
                <select
                  value={primaryOfferedCourseId}
                  onChange={(e) => setPrimaryOfferedCourseId(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="">Select primary section</option>
                  {primarySections.map((item) => (
                    <option key={`manual-primary-${item.id}`} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Target Program Code (optional)
                </label>
                <input
                  value={manualTargetProgramCode}
                  onChange={(e) => setManualTargetProgramCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border px-4 py-3"
                  placeholder="Example: BSC-EEE-EVE-NEW"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Manual Co-offered Course Code
                </label>
                <input
                  value={manualCourseCode}
                  onChange={(e) => setManualCourseCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border px-4 py-3"
                  placeholder="Example: EEE1237"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Note (optional)
                </label>
                <input
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                  placeholder="Example: old curriculum alias"
                />
              </div>

              <button
                type="button"
                onClick={addManualCooffer}
                disabled={savingManual || !primaryOfferedCourseId || !manualCourseCode.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {savingManual ? "Saving..." : "Add Manual Co-offered Code"}
              </button>
            </div>
          </div>
        </div>

        {selectedPrimarySection ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">
              Selected Primary Section Summary
            </h4>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div>
                  <span className="font-semibold">Course:</span>{" "}
                  {selectedPrimarySection.courseCode} — {selectedPrimarySection.courseTitle}
                </div>
                <div>
                  <span className="font-semibold">Section:</span> Sec-
                  {selectedPrimarySection.section}
                </div>
                <div>
                  <span className="font-semibold">Batches:</span>{" "}
                  {selectedPrimarySection.batchCodes.join(", ") || "-"}
                </div>
                <div>
                  <span className="font-semibold">Own Slots:</span>{" "}
                  {selectedPrimarySection.hasOwnSlots ? "Yes" : "No"}
                </div>
                <div>
                  <span className="font-semibold">Own Teachers:</span>{" "}
                  {selectedPrimarySection.hasOwnTeachers ? "Yes" : "No"}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">
                  Manual Co-offered Codes
                </div>

                {selectedPrimarySection.manualCooffers?.length ? (
                  <div className="space-y-2">
                    {selectedPrimarySection.manualCooffers.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      >
                        <div>
                          <div className="font-medium text-slate-900">
                            {item.manual_course_code}
                            {item.target_program_code ? ` [${item.target_program_code}]` : ""}
                          </div>
                          <div className="text-slate-500">{item.note || "-"}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteManualCooffer(item.id)}
                          disabled={deletingManualId === item.id}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {deletingManualId === item.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No manual co-offered codes added for this section yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-base font-semibold text-slate-900">Existing Linked Sections</h4>

          <div className="mt-4 space-y-3">
            {existingLinks.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No linked co-offering sections found for the selected pairing yet.
              </div>
            ) : (
              existingLinks.map((item) => (
                <div
                  key={`${item.primaryOfferedCourseId}-${item.secondaryOfferedCourseId}`}
                  className="rounded-xl border border-slate-200 px-4 py-4"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    Primary: {item.primaryLabel}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Secondary: {item.secondaryLabel}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Primary batches: {item.primaryBatchCodes.join(", ") || "-"}
                  </div>
                  <div className="text-xs text-slate-500">
                    Secondary batches: {item.secondaryBatchCodes.join(", ") || "-"}
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => unlinkSection(item.secondaryOfferedCourseId)}
                      disabled={unlinkingId === item.secondaryOfferedCourseId}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {unlinkingId === item.secondaryOfferedCourseId
                        ? "Removing..."
                        : "Remove Link"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
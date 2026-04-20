"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminLayout from "@/components/admin-layout";
import ProgramTermSelector from "@/components/program-term-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type SectionOption = {
  id: number;
  label: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  programCode: string;
  batchCodes: string[];
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
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [primarySections, setPrimarySections] = useState<SectionOption[]>([]);
  const [secondarySections, setSecondarySections] = useState<SectionOption[]>([]);
  const [existingLinks, setExistingLinks] = useState<ExistingLink[]>([]);

  const requestedProgramCode = searchParams.get("primaryProgramCode") || "";
  const requestedTermName = searchParams.get("termName") || "";
  const requestedPrimaryOfferedCourseId = searchParams.get("primaryOfferedCourseId") || "";

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

  async function loadOptions(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!termName || !programCode || !secondaryProgramCode) {
      setError("Please select term, primary academic identity, and secondary academic identity.");
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
      setError(err instanceof Error ? err.message : "Failed to load co-offering options.");
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
      setError(err instanceof Error ? err.message : "Failed to create co-offering link.");
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
      setError(err instanceof Error ? err.message : "Failed to remove co-offering link.");
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <AdminLayout title="Co-offering Setup">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Co-offering Setup</h3>
          <p className="mt-1 text-sm text-slate-500">
            Link already drafted primary and secondary sections inside the same academic term.
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
              {loading ? "Loading..." : "Load Draft Sections"}
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
            <h4 className="text-base font-semibold text-slate-900">Create Co-offering Link</h4>

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
                      {item.label}
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
                {linking ? "Linking..." : "Confirm Co-offering"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">Existing Links</h4>

            <div className="mt-4 space-y-3">
              {existingLinks.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No co-offering links found for the current selection.
                </div>
              ) : (
                existingLinks.map((item) => (
                  <div
                    key={`${item.primaryOfferedCourseId}-${item.secondaryOfferedCourseId}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      Primary: {item.primaryLabel}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      Secondary: {item.secondaryLabel}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Primary batches: {item.primaryBatchCodes.join(", ") || "-"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Secondary batches: {item.secondaryBatchCodes.join(", ") || "-"}
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => unlinkSection(item.secondaryOfferedCourseId)}
                        disabled={unlinkingId === item.secondaryOfferedCourseId}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        {unlinkingId === item.secondaryOfferedCourseId ? "Removing..." : "Remove Link"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
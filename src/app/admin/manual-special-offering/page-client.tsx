"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminLayout from "@/components/admin-layout";
import ProgramTermSelector from "@/components/program-term-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type Draft = {
  id: number;
  status: string;
  created_at: string | null;
  academic_terms: {
    name: string;
  };
  programs: {
    short_name: string;
    name: string;
  };
};

type DraftResponse = {
  ok?: boolean;
  error?: string;
  matchedProgramCodes?: string[];
  drafts?: Draft[];
};

type ManualCreateResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  routeVersion?: string;
  draftId?: number;
  primaryOfferedCourseId?: number;
  linkedSecondaryCount?: number;
  manualAliasCount?: number;
  createdPrimaryMasterCourse?: boolean;
  reusedPrimaryMasterCourse?: boolean;
  createdSecondaryMasterCourseCount?: number;
  reusedSecondaryMasterCourseCount?: number;
  attachedPrimaryBatchCodes?: string[];
  createdSecondaryRows?: Array<{
    offeredCourseId: number;
    programCode: string;
    courseCode: string;
    attachedBatchCodes: string[];
  }>;
};

type ProgramOption = {
  id: string;
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: string;
  curriculumVersion: string;
  displayLabel: string;
};

type FormState = {
  primaryCourseCode: string;
  primaryCourseTitle: string;
  section: string;
  credit: string;
  courseType: string;
  levelTerm: string;
  groupName: string;
  primaryBatchCodesText: string;
  primaryNotes: string;
  linkedCoursesText: string;
  manualAliasCodesText: string;
};

const DEFAULT_FORM: FormState = {
  primaryCourseCode: "",
  primaryCourseTitle: "",
  section: "",
  credit: "",
  courseType: "THEORY",
  levelTerm: "SPECIAL",
  groupName: "SPECIAL_MANUAL",
  primaryBatchCodesText: "",
  primaryNotes: "",
  linkedCoursesText: "",
  manualAliasCodesText: "",
};

export default function ManualSpecialOfferingPageClient() {
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

  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState("");
  const [matchedProgramCodes, setMatchedProgramCodes] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastResult, setLastResult] = useState<ManualCreateResponse | null>(null);

  const requestedProgramCode = searchParams.get("programCode") || "";
  const requestedTermName = searchParams.get("termName") || "";

  useEffect(() => {
    if (requestedProgramCode) {
      setProgramCode(requestedProgramCode);
    }
    if (requestedTermName) {
      setTermName(requestedTermName);
    }
  }, [requestedProgramCode, requestedTermName, setProgramCode, setTermName]);

  const combinedError = error || programError || termError;

  async function loadDrafts(e?: React.FormEvent) {
    if (e) e.preventDefault();

    setError("");
    setMessage("");
    setLastResult(null);

    if (!programCode || !termName) {
      setError("Please select both academic identity and academic term first.");
      setDrafts([]);
      setDraftId("");
      return;
    }

    setLoadingDrafts(true);

    try {
      const params = new URLSearchParams({
        programCode,
        termName,
      });

      const res = await fetch(`/api/offerings/drafts?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: DraftResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load draft offerings.");
      }

      const nextDrafts = (json.drafts || []).map((row) => ({
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        academic_terms: row.academic_terms,
        programs: row.programs,
      }));

      setDrafts(nextDrafts);
      setMatchedProgramCodes(json.matchedProgramCodes || []);

      if (nextDrafts.length > 0) {
        setDraftId(String(nextDrafts[0].id));
        setMessage(
          "Draft offerings loaded. You can now add a manual/special primary course with optional real linked secondary co-offered rows."
        );
      } else {
        setDraftId("");
        setMessage(
          "No DRAFT offering found. Create or load a draft first from Offering Context / Draft Offerings."
        );
      }
    } catch (err) {
      setDrafts([]);
      setDraftId("");
      setError(err instanceof Error ? err.message : "Failed to load draft offerings.");
    } finally {
      setLoadingDrafts(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setMessage("");
    setLastResult(null);

    if (!programCode || !termName) {
      setError("Please select academic identity and term.");
      return;
    }

    if (!draftId) {
      setError("Please load and select a DRAFT offering first.");
      return;
    }

    if (!form.primaryCourseCode.trim()) {
      setError("Primary course code is required.");
      return;
    }

    if (!form.primaryCourseTitle.trim()) {
      setError("Primary course title is required.");
      return;
    }

    if (!form.section.trim()) {
      setError("Section is required.");
      return;
    }

    if (!form.credit.trim()) {
      setError("Credit is required.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/offerings/drafts/manual-special", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draftId: Number(draftId),
          primaryCourseCode: form.primaryCourseCode,
          primaryCourseTitle: form.primaryCourseTitle,
          section: form.section,
          credit: form.credit,
          courseType: form.courseType,
          levelTerm: form.levelTerm,
          groupName: form.groupName,
          primaryBatchCodesText: form.primaryBatchCodesText,
          primaryNotes: form.primaryNotes,
          linkedCoursesText: form.linkedCoursesText,
          manualAliasCodesText: form.manualAliasCodesText,
        }),
      });

      const json: ManualCreateResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          `${json.error || "Failed to add manual special course."}${json.routeVersion ? ` [${json.routeVersion}]` : ""}`
        );
      }

      setLastResult(json);
      setMessage(json.message || "Manual special course added successfully.");
      setForm(DEFAULT_FORM);
      await loadDrafts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add manual special course."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedDraft = useMemo(() => {
    return drafts.find((row) => String(row.id) === draftId) || null;
  }, [draftId, drafts]);

  const selectedProgram = useMemo(() => {
    return programs.find((item) => item.programCode === programCode) || null;
  }, [programCode, programs]);

  return (
    <AdminLayout title="Manual Special Offering Entry">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Manual / Special Offering Entry With Real Co-offering Creation
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            This creates a normal primary offered course inside the selected DRAFT offering.
            It can also create real linked secondary co-offered rows in other program drafts of the same term,
            so they remain part of the existing system and will flow into faculty-choice like normal offerings.
          </p>
        </div>

        <form onSubmit={loadDrafts} className="space-y-4">
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

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loadingDrafts || !programCode || !termName}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loadingDrafts ? "Loading Drafts..." : "Load Drafts"}
            </button>

            <a
              href={`/admin/offering-drafts?programCode=${encodeURIComponent(programCode || "")}&termName=${encodeURIComponent(termName || "")}`}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open Draft Offerings
            </a>

            <a
              href={`/admin/co-offering-setup?primaryProgramCode=${encodeURIComponent(programCode || "")}&termName=${encodeURIComponent(termName || "")}`}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Open Co-offering Setup
            </a>
          </div>
        </form>

        {matchedProgramCodes.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Draft lookup matched program(s): {matchedProgramCodes.join(", ")}
          </div>
        )}

        {drafts.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Select Primary DRAFT Offering
                </label>
                <select
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="">Select draft</option>
                  {drafts.map((draft) => (
                    <option key={draft.id} value={draft.id}>
                      Draft #{draft.id} | {draft.programs.short_name} | {draft.academic_terms.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <span className="font-medium text-slate-700">Selected draft:</span>{" "}
                  {selectedDraft
                    ? `#${selectedDraft.id} — ${selectedDraft.programs.short_name} — ${selectedDraft.academic_terms.name}`
                    : "-"}
                </div>
                <div className="mt-2">
                  <span className="font-medium text-slate-700">Status:</span>{" "}
                  {selectedDraft?.status || "-"}
                </div>
                <div className="mt-2">
                  <span className="font-medium text-slate-700">Primary academic identity:</span>{" "}
                  {selectedProgram?.displayLabel || programCode || "-"}
                </div>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-base font-semibold text-slate-900">
              Primary Special Course
            </h4>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Primary Course Code
                </label>
                <input
                  value={form.primaryCourseCode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      primaryCourseCode: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="EEE4999"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Section
                </label>
                <input
                  value={form.section}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      section: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="11"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Primary Course Title
                </label>
                <input
                  value={form.primaryCourseTitle}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      primaryCourseTitle: e.target.value,
                    }))
                  }
                  placeholder="Special Topics in Power Systems"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Credit
                </label>
                <input
                  value={form.credit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      credit: e.target.value,
                    }))
                  }
                  placeholder="3"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Course Type
                </label>
                <input
                  value={form.courseType}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      courseType: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="THEORY / LAB / PROJECT / INTERNSHIP"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Level / Term
                </label>
                <input
                  value={form.levelTerm}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      levelTerm: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="SPECIAL"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Group Name
                </label>
                <input
                  value={form.groupName}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      groupName: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="SPECIAL_MANUAL"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Primary Batch Codes
                </label>
                <input
                  value={form.primaryBatchCodesText}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      primaryBatchCodesText: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="261, 262"
                  className="w-full rounded-xl border px-4 py-3"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Optional. Comma-separated batch codes under the selected primary program.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Primary Notes
                </label>
                <textarea
                  value={form.primaryNotes}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      primaryNotes: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Reason / special condition note"
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-base font-semibold text-slate-900">
              Real Linked Secondary Co-offered Rows
            </h4>

            <p className="mt-2 text-sm text-slate-500">
              Each non-empty line creates a real secondary offered course row in the DRAFT offering of that target program,
              using the same section and same term, and links it under the primary using the existing co-offering structure.
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Linked Secondary Rows
              </label>
              <textarea
                value={form.linkedCoursesText}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    linkedCoursesText: e.target.value.toUpperCase(),
                  }))
                }
                rows={8}
                placeholder={
                  "ONE LINE PER SECONDARY:\n" +
                  "PROGRAM_CODE | COURSE_CODE | COURSE_TITLE | CREDIT | COURSE_TYPE | BATCH1,BATCH2 | NOTES\n\n" +
                  "EXAMPLE:\n" +
                  "RAE-REG-NEW | RAE3102 | CONTROL SYSTEMS FOR RAE | 3 | THEORY | 261 | CO-OFFERED WITH PRIMARY\n" +
                  "EEE-EVE-NEW | EEE5101 | ADVANCED POWER SYSTEMS | 3 | THEORY | 262 | EVENING LINK"
                }
                className="w-full rounded-xl border px-4 py-3 font-mono text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">
                Format per line:
                PROGRAM_CODE | COURSE_CODE | COURSE_TITLE | CREDIT | COURSE_TYPE | BATCH1,BATCH2 | NOTES
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-base font-semibold text-slate-900">
              Optional Manual Alias Co-offered Codes
            </h4>

            <p className="mt-2 text-sm text-slate-500">
              These are metadata aliases on the primary row only. They do not create separate offered-course rows.
              Use them when you need old-curriculum or export aliases in addition to real linked secondary rows.
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Manual Alias Codes
              </label>
              <textarea
                value={form.manualAliasCodesText}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    manualAliasCodesText: e.target.value.toUpperCase(),
                  }))
                }
                rows={6}
                placeholder={
                  "EITHER:\n" +
                  "MANUAL_COURSE_CODE | NOTE\n\n" +
                  "OR:\n" +
                  "TARGET_PROGRAM_CODE | MANUAL_COURSE_CODE | NOTE\n\n" +
                  "EXAMPLE:\n" +
                  "EEE1237 | OLD CURRICULUM ALIAS\n" +
                  "EEE-EVE-NEW | EEE2235 | EVENING ALIAS"
                }
                className="w-full rounded-xl border px-4 py-3 font-mono text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !draftId}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting
              ? "Saving..."
              : "Create Manual Primary + Optional Linked Co-offered Rows"}
          </button>
        </form>

        {combinedError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">
            {combinedError}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {lastResult && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <h4 className="mb-4 text-base font-semibold text-blue-900">
              Manual Entry Result
            </h4>

            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <span className="font-medium text-blue-900">Route Version:</span>{" "}
                <span className="text-slate-700">{lastResult.routeVersion || "-"}</span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Draft ID:</span>{" "}
                <span className="text-slate-700">{lastResult.draftId || "-"}</span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Primary Offered Course ID:</span>{" "}
                <span className="text-slate-700">{lastResult.primaryOfferedCourseId || "-"}</span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Primary Master Course:</span>{" "}
                <span className="text-slate-700">
                  {lastResult.createdPrimaryMasterCourse
                    ? "Created new special manual master course"
                    : lastResult.reusedPrimaryMasterCourse
                      ? "Reused existing matching master course"
                      : "-"}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Linked Secondary Rows:</span>{" "}
                <span className="text-slate-700">{lastResult.linkedSecondaryCount || 0}</span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Manual Alias Codes:</span>{" "}
                <span className="text-slate-700">{lastResult.manualAliasCount || 0}</span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Created Secondary Master Courses:</span>{" "}
                <span className="text-slate-700">{lastResult.createdSecondaryMasterCourseCount || 0}</span>
              </div>
              <div>
                <span className="font-medium text-blue-900">Reused Secondary Master Courses:</span>{" "}
                <span className="text-slate-700">{lastResult.reusedSecondaryMasterCourseCount || 0}</span>
              </div>

              <div className="md:col-span-2">
                <span className="font-medium text-blue-900">Primary Attached Batches:</span>{" "}
                <span className="text-slate-700">
                  {(lastResult.attachedPrimaryBatchCodes || []).join(", ") || "-"}
                </span>
              </div>

              <div className="md:col-span-2">
                <span className="font-medium text-blue-900">Created Secondary Rows:</span>
                <div className="mt-2 space-y-2">
                  {(lastResult.createdSecondaryRows || []).length === 0 ? (
                    <div className="text-slate-700">-</div>
                  ) : (
                    lastResult.createdSecondaryRows!.map((item) => (
                      <div
                        key={`${item.programCode}-${item.offeredCourseId}`}
                        className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-slate-700"
                      >
                        <div>
                          <span className="font-medium">Program:</span> {item.programCode}
                        </div>
                        <div>
                          <span className="font-medium">Course:</span> {item.courseCode}
                        </div>
                        <div>
                          <span className="font-medium">Offered Course ID:</span> {item.offeredCourseId}
                        </div>
                        <div>
                          <span className="font-medium">Attached Batches:</span>{" "}
                          {item.attachedBatchCodes.join(", ") || "-"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <span className="font-medium text-blue-900">Message:</span>{" "}
                <span className="text-slate-700">{lastResult.message || "-"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
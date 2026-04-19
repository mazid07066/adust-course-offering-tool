"use client";

import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramBatchSelector from "@/components/program-batch-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useProgramBatches } from "@/hooks/use-program-batches";

type OfferingContextCourse = {
  id: number;
  courseCode: string;
  courseTitle: string;
  normalizedTitle: string | null;
  credit: number | null;
  courseType: string | null;
  levelTerm: string | null;
  groupName: string | null;
  status: "COMPLETED" | "ONGOING" | "REMAINING";
};

type ContextData = {
  ok?: boolean;
  success?: boolean;
  error?: string;

  programId: number;
  programCode: string;
  programLabel: string;

  resolvedBatchProgramId: number;
  resolvedBatchProgramShortName: string;
  resolvedBatchProgramName: string;

  batchId: number;
  batchCode: string;
  batchAdmissionTerm: string | null;

  currentTermName: string | null;
  latestCompletedAcademicTerm: string | null;
  suggestedOfferingAcademicTerm: string | null;

  latestCompletedLevelTerm: string | null;
  latestOngoingLevelTerm: string | null;
  suggestedNextLevelTerm: string | null;

  completedCount: number;
  ongoingCount: number;
  remainingCount: number;
  totalCourses: number;

  completedCourses: OfferingContextCourse[];
  ongoingCourses: OfferingContextCourse[];
  remainingCourses: OfferingContextCourse[];
  candidateCoursesForNextOffering: OfferingContextCourse[];

  academicProgress: {
    latestCompletedTerm: string | null;
    currentRegistrationTerm: string | null;
    suggestedOfferingTerm: string | null;
  };

  summary: {
    totalCourses: number;
    completedCourses: number;
    ongoingCourses: number;
    remainingCourses: number;
  };
};

type DraftContextResponse = {
  ok?: boolean;
  error?: string;
  draftId: number | null;
  hiddenCourseIds: number[];
  totalDraftCredits: number;
};

function CourseTable({
  title,
  subtitle,
  badgeText,
  badgeClassName,
  courses,
  emptyText,
  showAddAction = false,
  canAdd = false,
  onAddCourse,
  addingCourseId,
}: {
  title: string;
  subtitle: string;
  badgeText: string;
  badgeClassName: string;
  courses: OfferingContextCourse[];
  emptyText: string;
  showAddAction?: boolean;
  canAdd?: boolean;
  onAddCourse?: (course: OfferingContextCourse) => Promise<void>;
  addingCourseId?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClassName}`}>
          {badgeText}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="border-b border-slate-200 px-3 py-3 text-left">Code</th>
              <th className="border-b border-slate-200 px-3 py-3 text-left">Title</th>
              <th className="border-b border-slate-200 px-3 py-3 text-left">Credit</th>
              <th className="border-b border-slate-200 px-3 py-3 text-left">Type</th>
              <th className="border-b border-slate-200 px-3 py-3 text-left">Level-Term</th>
              <th className="border-b border-slate-200 px-3 py-3 text-left">Group</th>
              {showAddAction && (
                <th className="border-b border-slate-200 px-3 py-3 text-left">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white">
            {courses.length === 0 ? (
              <tr>
                <td
                  colSpan={showAddAction ? 7 : 6}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              courses.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">
                    {course.courseCode}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {course.courseTitle}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {course.credit ?? "-"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {course.courseType || "-"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {course.levelTerm || "-"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {course.groupName || "-"}
                  </td>
                  {showAddAction && (
                    <td className="border-b border-slate-100 px-3 py-2">
                      <button
                        type="button"
                        disabled={!canAdd || addingCourseId === course.id}
                        onClick={() => onAddCourse?.(course)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {addingCourseId === course.id ? "Adding..." : "Add"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OfferingsPageClient() {
  const {
    programs,
    programCode,
    setProgramCode,
    selectedProgram,
    loadingPrograms,
    programError,
  } = useAcademicCatalogPrograms();

  const {
    batches,
    batchCode,
    setBatchCode,
    loadingBatches,
    batchError,
  } = useProgramBatches(programCode);

  const [loadingContext, setLoadingContext] = useState(false);
  const [loadingDraftContext, setLoadingDraftContext] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [contextData, setContextData] = useState<ContextData | null>(null);

  const [draftId, setDraftId] = useState<number | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [addingCourseId, setAddingCourseId] = useState<number | null>(null);

  const [hiddenCourseIds, setHiddenCourseIds] = useState<number[]>([]);
  const [totalDraftCredits, setTotalDraftCredits] = useState(0);
  const [maxAllowedCredits, setMaxAllowedCredits] = useState("18");

  async function loadDraftContext(
    selectedProgramCode: string,
    selectedBatchCode: string,
    selectedTermName: string
  ) {
    setLoadingDraftContext(true);

    try {
      const params = new URLSearchParams({
        programCode: selectedProgramCode,
        batchCode: selectedBatchCode,
        termName: selectedTermName,
      });

      const res = await fetch(`/api/offerings/drafts/context?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: DraftContextResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load draft context.");
      }

      setDraftId(json.draftId || null);
      setHiddenCourseIds(json.hiddenCourseIds || []);
      setTotalDraftCredits(Number(json.totalDraftCredits || 0));
    } catch (err) {
      setDraftId(null);
      setHiddenCourseIds([]);
      setTotalDraftCredits(0);
      throw err;
    } finally {
      setLoadingDraftContext(false);
    }
  }

  async function loadContext(e: React.FormEvent) {
    e.preventDefault();

    if (!programCode || !batchCode) {
      setError("Please select both academic identity and batch.");
      setMessage("");
      setContextData(null);
      setDraftId(null);
      setHiddenCourseIds([]);
      setTotalDraftCredits(0);
      return;
    }

    setLoadingContext(true);
    setError("");
    setMessage("");
    setContextData(null);
    setDraftId(null);
    setHiddenCourseIds([]);
    setTotalDraftCredits(0);

    try {
      const params = new URLSearchParams({
        programCode,
        batchCode,
      });

      const res = await fetch(`/api/offering-context?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: ContextData = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load offering context.");
      }

      setContextData(json);

      if (json.suggestedOfferingAcademicTerm) {
        await loadDraftContext(
          json.programCode,
          json.batchCode,
          json.suggestedOfferingAcademicTerm
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load offering context."
      );
    } finally {
      setLoadingContext(false);
    }
  }

  async function createDraftOffering() {
    if (!contextData) {
      setError("Load workspace first.");
      setMessage("");
      return;
    }

    if (!contextData.programCode || !contextData.suggestedOfferingAcademicTerm) {
      setError("Program code or suggested offering term is missing.");
      setMessage("");
      return;
    }

    setCreatingDraft(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/offerings/drafts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programCode: contextData.programCode,
          termName: contextData.suggestedOfferingAcademicTerm,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create draft offering.");
      }

      setDraftId(json.draftId);

      await loadDraftContext(
        contextData.programCode,
        contextData.batchCode,
        contextData.suggestedOfferingAcademicTerm
      );

      setMessage(
        json.reused
          ? `Existing draft loaded successfully. Draft ID: ${json.draftId}`
          : `Draft offering created successfully. Draft ID: ${json.draftId}`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create draft offering."
      );
    } finally {
      setCreatingDraft(false);
    }
  }

  async function handleAddCourse(course: OfferingContextCourse) {
    if (!contextData) {
      setError("Load workspace first.");
      setMessage("");
      return;
    }

    if (!draftId) {
      setError("Create draft offering first.");
      setMessage("");
      return;
    }

    const sectionInput = window.prompt("Enter section number (example: 1, 2, 11)");
    if (!sectionInput) return;

    const section = sectionInput.trim();
    if (!section) return;

    setAddingCourseId(course.id);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/offerings/drafts/add-course", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draftId,
          courseId: course.id,
          section,
          batchIds: [contextData.batchId],
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to add course to draft.");
      }

      await loadDraftContext(
        contextData.programCode,
        contextData.batchCode,
        contextData.suggestedOfferingAcademicTerm || ""
      );

      setMessage(
        `Course added to draft successfully. ${course.courseCode} | Section ${section}`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add course to draft."
      );
    } finally {
      setAddingCourseId(null);
    }
  }

  const visibleCandidateCourses = useMemo(() => {
    return (contextData?.candidateCoursesForNextOffering || []).filter(
      (course) => !hiddenCourseIds.includes(course.id)
    );
  }, [contextData?.candidateCoursesForNextOffering, hiddenCourseIds]);

  const visibleRemainingCourses = useMemo(() => {
    return (contextData?.remainingCourses || []).filter(
      (course) => !hiddenCourseIds.includes(course.id)
    );
  }, [contextData?.remainingCourses, hiddenCourseIds]);

  const maxCreditsNumber = Number(maxAllowedCredits || 0);
  const exceedsMaxCredits =
    Number.isFinite(maxCreditsNumber) &&
    maxCreditsNumber > 0 &&
    totalDraftCredits > maxCreditsNumber;

  const combinedError = error || programError || batchError;

  return (
    <AdminLayout title="Offerings Workspace">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Offerings Workspace
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Load a batch context first, then use the recommended course pool as the
            working starting point for open-credit offering preparation.
          </p>
        </div>

        <form onSubmit={loadContext} className="space-y-4">
          <ProgramBatchSelector
            programs={programs}
            programCode={programCode}
            setProgramCode={setProgramCode}
            loadingPrograms={loadingPrograms}
            batches={batches}
            batchCode={batchCode}
            setBatchCode={setBatchCode}
            loadingBatches={loadingBatches}
            showBatch={true}
          />

          <button
            type="submit"
            disabled={loadingContext || !programCode || !batchCode}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loadingContext ? "Loading..." : "Load Workspace"}
          </button>
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

        {selectedProgram && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Selected Academic Identity</p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {selectedProgram.displayLabel}
            </p>
          </div>
        )}

        {contextData && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={createDraftOffering}
                disabled={creatingDraft || !contextData.suggestedOfferingAcademicTerm}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingDraft ? "Creating..." : "Create Draft Offering"}
              </button>

              {loadingDraftContext && (
                <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                  Loading draft context...
                </div>
              )}

              {draftId && (
                <div className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
                  Active Draft ID: {draftId}
                </div>
              )}

              {contextData.suggestedOfferingAcademicTerm && (
                <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                  Draft Term: {contextData.suggestedOfferingAcademicTerm}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Latest Completed Semester</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {contextData.academicProgress.latestCompletedTerm || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm text-amber-700">Current Registration Semester</p>
                <p className="mt-2 text-xl font-semibold text-amber-900">
                  {contextData.academicProgress.currentRegistrationTerm || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="text-sm text-green-700">Suggested Offering Semester</p>
                <p className="mt-2 text-xl font-semibold text-green-900">
                  {contextData.academicProgress.suggestedOfferingTerm || "-"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Latest Completed Level-Term</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {contextData.latestCompletedLevelTerm || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm text-amber-700">Latest Ongoing Level-Term</p>
                <p className="mt-2 text-xl font-semibold text-amber-900">
                  {contextData.latestOngoingLevelTerm || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="text-sm text-green-700">Suggested Next Level-Term</p>
                <p className="mt-2 text-xl font-semibold text-green-900">
                  {contextData.suggestedNextLevelTerm || "-"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total Courses</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {contextData.summary.totalCourses}
                </p>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="text-sm text-green-700">Completed</p>
                <p className="mt-2 text-2xl font-semibold text-green-800">
                  {contextData.summary.completedCourses}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm text-amber-700">Ongoing</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800">
                  {contextData.summary.ongoingCourses}
                </p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <p className="text-sm text-red-700">Remaining</p>
                <p className="mt-2 text-2xl font-semibold text-red-800">
                  {visibleRemainingCourses.length}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Current Draft Credits</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {totalDraftCredits}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <label className="text-sm text-slate-500">Maximum Allowed Credits</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={maxAllowedCredits}
                  onChange={(e) => setMaxAllowedCredits(e.target.value)}
                  className="mt-2 w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div
                className={`rounded-2xl border p-5 shadow-sm ${
                  exceedsMaxCredits
                    ? "border-red-200 bg-red-50"
                    : "border-green-200 bg-green-50"
                }`}
              >
                <p
                  className={`text-sm ${
                    exceedsMaxCredits ? "text-red-700" : "text-green-700"
                  }`}
                >
                  Draft Credit Status
                </p>
                <p
                  className={`mt-2 text-sm font-semibold ${
                    exceedsMaxCredits ? "text-red-800" : "text-green-800"
                  }`}
                >
                  {exceedsMaxCredits
                    ? `Warning: current draft credit (${totalDraftCredits}) exceeds maximum allowed credit (${maxCreditsNumber}).`
                    : "Within the current maximum credit limit."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Requested Academic Identity</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {contextData.programCode}
                </p>
                <p className="mt-1 text-sm text-slate-600">{contextData.programLabel}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Resolved Batch Owner Program</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {contextData.resolvedBatchProgramShortName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {contextData.resolvedBatchProgramName}
                </p>
              </div>
            </div>

            <CourseTable
              title="Candidate Courses for Next Offering"
              subtitle="Recommended starting pool from the saved academic progression. Courses already assigned in the current draft for this batch are hidden."
              badgeText={`${visibleCandidateCourses.length} course(s)`}
              badgeClassName="bg-slate-100 text-slate-700"
              courses={visibleCandidateCourses}
              emptyText="No candidate course found."
              showAddAction={true}
              canAdd={Boolean(draftId)}
              onAddCourse={handleAddCourse}
              addingCourseId={addingCourseId}
            />

            <CourseTable
              title="All Remaining Courses"
              subtitle="Full remaining course pool for this batch. Courses already assigned in the current draft for this batch are hidden."
              badgeText={`${visibleRemainingCourses.length} remaining`}
              badgeClassName="bg-red-50 text-red-700"
              courses={visibleRemainingCourses}
              emptyText="No remaining course loaded yet."
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-base font-semibold text-slate-900">
                Next development note
              </h4>
              <p className="mt-2 text-sm text-slate-600">
                This workspace now blocks duplicate same-course assignment for the same
                batch in the same draft, hides already drafted courses for the current
                batch, and shows current draft credit status against a maximum credit limit.
              </p>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
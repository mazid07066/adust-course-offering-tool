"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramBatchSelector from "@/components/program-batch-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useProgramBatches } from "@/hooks/use-program-batches";

type RemainingCourse = {
  id: number;
  course_code: string;
  course_title: string;
  credit: number;
  course_type: string;
  level_term: string | null;
};

type ContextData = {
  success?: boolean;
  error?: string;
  academicProgress?: {
    latestCompletedTerm: string | null;
    currentRegistrationTerm: string | null;
    suggestedOfferingTerm: string | null;
  };
  remainingCourses?: RemainingCourse[];
};

export default function OfferingsPageClient() {
  const {
    programs,
    programCode,
    setProgramCode,
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
  const [error, setError] = useState("");
  const [contextData, setContextData] = useState<ContextData | null>(null);

  async function loadContext(e: React.FormEvent) {
    e.preventDefault();

    setLoadingContext(true);
    setError("");
    setContextData(null);

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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load offering context."
      );
    } finally {
      setLoadingContext(false);
    }
  }

  const combinedError = error || programError || batchError;

  return (
    <AdminLayout title="Offerings Workspace">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Offerings workspace
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Program and batch are now selected from dropdowns only.
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

        {contextData?.academicProgress && (
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
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="mb-4 text-base font-semibold text-slate-900">
            Remaining Courses
          </h4>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Code</th>
                  <th className="border-b px-3 py-3 text-left">Title</th>
                  <th className="border-b px-3 py-3 text-left">Credit</th>
                  <th className="border-b px-3 py-3 text-left">Type</th>
                  <th className="border-b px-3 py-3 text-left">Level</th>
                </tr>
              </thead>
              <tbody>
                {(contextData?.remainingCourses || []).map((course) => (
                  <tr key={course.id}>
                    <td className="border-b px-3 py-2">{course.course_code}</td>
                    <td className="border-b px-3 py-2">{course.course_title}</td>
                    <td className="border-b px-3 py-2">{course.credit}</td>
                    <td className="border-b px-3 py-2">{course.course_type}</td>
                    <td className="border-b px-3 py-2">{course.level_term || "-"}</td>
                  </tr>
                ))}

                {(contextData?.remainingCourses || []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No remaining courses loaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            This page now uses dropdown-only program and batch selection. Your existing save/assign logic can continue on top of this selection model.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
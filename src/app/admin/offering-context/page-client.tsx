"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
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

type ResponseData = {
  ok: boolean;
  success: boolean;
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

export default function OfferingContextPageClient() {
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ResponseData | null>(null);

  async function handleLoad(e: React.FormEvent) {
    e.preventDefault();

    if (!programCode || !batchCode) {
      setError("Please select both academic identity and batch.");
      setData(null);
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const params = new URLSearchParams({
        programCode,
        batchCode,
      });

      const res = await fetch(`/api/offering-context?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json()) as ResponseData | { error?: string };

      if (!res.ok) {
        throw new Error(json.error || "Failed to load offering context.");
      }

      setData(json as ResponseData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load offering context."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout title="Offering Context">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Offering Context
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Load saved batch progression and identify the next likely offering set.
          </p>
        </div>

        <form onSubmit={handleLoad} className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Academic Identity
            </label>
            <select
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
              disabled={loadingPrograms}
            >
              {programs.length === 0 && <option value="">No academic identity found</option>}
              {programs.map((program) => (
                <option key={program.programCode} value={program.programCode}>
                  {program.displayLabel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Batch
            </label>
            <select
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
              disabled={loadingBatches || !programCode}
            >
              {batches.length === 0 && <option value="">No batch found</option>}
              {batches.map((batch) => (
                <option key={batch.id} value={batch.batchCode}>
                  {batch.batchCode}
                  {batch.admissionTerm ? ` | ${batch.admissionTerm}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || loadingPrograms || loadingBatches || !programCode || !batchCode}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Context"}
            </button>
          </div>
        </form>

        {(programError || batchError || error) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {programError || batchError || error}
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

        {data && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Latest Completed Semester</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {data.academicProgress.latestCompletedTerm || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm text-amber-700">Current Registration Semester</p>
                <p className="mt-2 text-xl font-semibold text-amber-800">
                  {data.academicProgress.currentRegistrationTerm || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="text-sm text-green-700">Suggested Offering Semester</p>
                <p className="mt-2 text-xl font-semibold text-green-800">
                  {data.academicProgress.suggestedOfferingTerm || "-"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Latest Completed Level-Term</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {data.latestCompletedLevelTerm || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm text-amber-700">Latest Ongoing Level-Term</p>
                <p className="mt-2 text-xl font-semibold text-amber-800">
                  {data.latestOngoingLevelTerm || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="text-sm text-green-700">Suggested Next Level-Term</p>
                <p className="mt-2 text-xl font-semibold text-green-800">
                  {data.suggestedNextLevelTerm || "-"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total Courses</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {data.summary.totalCourses}
                </p>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="text-sm text-green-700">Completed</p>
                <p className="mt-2 text-2xl font-semibold text-green-800">
                  {data.summary.completedCourses}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <p className="text-sm text-amber-700">Ongoing</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800">
                  {data.summary.ongoingCourses}
                </p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <p className="text-sm text-red-700">Remaining</p>
                <p className="mt-2 text-2xl font-semibold text-red-800">
                  {data.summary.remainingCourses}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Requested Academic Identity</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {data.programCode}
                </p>
                <p className="mt-1 text-sm text-slate-600">{data.programLabel}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Resolved Batch Owner Program</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {data.resolvedBatchProgramShortName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {data.resolvedBatchProgramName}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Candidate Courses for Next Offering</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Showing the recommended subset based on saved progression.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {data.candidateCoursesForNextOffering.length} course(s)
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Code</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Title</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Credit</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Type</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Level-Term</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Group</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {data.candidateCoursesForNextOffering.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-slate-500"
                        >
                          No candidate course found.
                        </td>
                      </tr>
                    ) : (
                      data.candidateCoursesForNextOffering.map((course) => (
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">All Remaining Courses</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Full remaining course pool for this batch.
                  </p>
                </div>
                <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                  {data.remainingCourses.length} remaining
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Code</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Title</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Credit</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Type</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left">Level-Term</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {data.remainingCourses.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-center text-slate-500"
                        >
                          No remaining course found.
                        </td>
                      </tr>
                    ) : (
                      data.remainingCourses.map((course) => (
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
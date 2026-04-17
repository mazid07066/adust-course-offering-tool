"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";

type RemainingCourse = {
  id: number;
  course_code: string;
  course_title: string;
  credit: number;
  course_type: string;
  level_term: string | null;
  group_name: string | null;
  course_category: string | null;
  course_classification: string | null;
};

type ResponseData = {
  success?: boolean;
  error?: string;
  academicProgress?: {
    latestCompletedTerm: string | null;
    currentRegistrationTerm: string | null;
    suggestedOfferingTerm: string | null;
  };
  summary?: {
    totalCourses: number;
    completedCourses: number;
    ongoingCourses: number;
    remainingCourses: number;
  };
  remainingCourses?: RemainingCourse[];
};

export default function OfferingContextPageClient() {
  const [programCode, setProgramCode] = useState("BSC-RAE");
  const [batchCode, setBatchCode] = useState("232");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ResponseData | null>(null);

  async function handleLoad(e: React.FormEvent) {
    e.preventDefault();

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

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load offering context");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offering context");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout title="Offering Context">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Suggested next offering semester
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            View academic progression and remaining courses for a selected batch.
          </p>
        </div>

        <form onSubmit={handleLoad} className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Program Code
            </label>
            <input
              type="text"
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Batch Code
            </label>
            <input
              type="text"
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Context"}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data?.academicProgress && (
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
        )}

        {data?.summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total</p>
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
        )}

        {data?.remainingCourses && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3 text-left">Code</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-left">Title</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-left">Credit</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-left">Type</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-left">Level Term</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.remainingCourses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">
                      {course.course_code}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {course.course_title}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {course.credit}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {course.course_type}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {course.level_term || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
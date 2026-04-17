"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type MasterCourse = {
  id: number;
  course_code: string;
  course_title: string;
  credit: number;
  course_type: string;
  level_term: string | null;
  group_name: string | null;
  course_category: string | null;
  course_classification: string | null;
  is_active: boolean | null;
};

type Program = {
  id: number;
  name: string;
  short_name: string;
  master_courses: MasterCourse[];
};

type Department = {
  id: number;
  name: string;
  short_name: string;
  programs: Program[];
};

export default function CoursesPageClient() {
  const [data, setData] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/courses", {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load courses");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleDelete(programCode: string) {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete all courses for ${programCode}?`
    );

    if (!confirmDelete) return;

    try {
      const res = await fetch("/api/master-courses/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ programCode }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Delete failed");
      }

      await fetchData();
      alert("Courses deleted successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AdminLayout title="Master Course List">
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Department and program course catalogs
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Review uploaded master course lists and delete existing courses program-wise when needed.
          </p>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Loading courses...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            No course data found.
          </div>
        )}

        {!loading &&
          !error &&
          data.map((dept) => (
            <div key={dept.id} className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {dept.name} ({dept.short_name})
                </h2>
              </div>

              {dept.programs.map((program) => (
                <div
                  key={program.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">
                        {program.name} ({program.short_name})
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Total courses: {program.master_courses.length}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(program.short_name)}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Delete All Courses
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                            Code
                          </th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                            Title
                          </th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                            Credit
                          </th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                            Type
                          </th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                            Level Term
                          </th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                            Group
                          </th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                            Category
                          </th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                            Class
                          </th>
                          <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                            Active
                          </th>
                        </tr>
                      </thead>

                      <tbody className="bg-white">
                        {program.master_courses.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">
                              {c.course_code}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                              {c.course_title}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                              {c.credit}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                              {c.course_type}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                              {c.level_term || "-"}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                              {c.group_name || "-"}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                              {c.course_category || "-"}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                              {c.course_classification || "-"}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                              {c.is_active ? "Yes" : "No"}
                            </td>
                          </tr>
                        ))}

                        {program.master_courses.length === 0 && (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-4 py-8 text-center text-sm text-slate-500"
                            >
                              No courses found for this program.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>
    </AdminLayout>
  );
}
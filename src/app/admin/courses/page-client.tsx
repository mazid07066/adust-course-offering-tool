"use client";

import { useEffect, useState } from "react";

type ProgramOption = {
  id: number;
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: string;
  curriculumVersion: string;
  curriculumKey: string | null;
  studentIdSuffix: string | null;
  displayLabel: string;
  active: boolean;
};

type CourseRow = {
  id: number;
  curriculumKey: string | null;
  courseCode: string;
  courseTitle: string;
  credit: number;
  courseType: string;
  levelTerm: string | null;
  groupName: string | null;
  isActive: boolean;
};

export default function CoursesPageClient() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programCode, setProgramCode] = useState("");
  const [selectedProgramLabel, setSelectedProgramLabel] = useState("");
  const [selectedCurriculumKey, setSelectedCurriculumKey] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadPrograms() {
    try {
      const res = await fetch("/api/academic-catalog/options", { cache: "no-store" });
      const data = await res.json();
      setPrograms(data.programs || []);
    } catch {
      setPrograms([]);
    }
  }

  async function loadCourses(targetProgramCode: string) {
    if (!targetProgramCode) {
      setCourses([]);
      setSelectedProgramLabel("");
      setSelectedCurriculumKey(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/courses?programCode=${encodeURIComponent(targetProgramCode)}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load courses.");
      }

      setCourses(data.items || []);
      setSelectedProgramLabel(data.selectedProgram?.displayLabel || "");
      setSelectedCurriculumKey(data.selectedProgram?.curriculumKey || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses.");
      setCourses([]);
      setSelectedProgramLabel("");
      setSelectedCurriculumKey(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrograms();
  }, []);

  useEffect(() => {
    if (programCode) {
      loadCourses(programCode);
    }
  }, [programCode]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Curriculum Course View</h2>

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-slate-700">
          <p className="font-semibold text-slate-900">Shared curriculum rule</p>
          <p className="mt-2">
            Multiple academic identities may use the same curriculum key. In that case, the same
            shared course list is shown for all those identities.
          </p>
          <p className="mt-2">
            Example: if both <span className="rounded bg-white px-2 py-1 font-semibold">BSC-RAE-REG-OLD</span> and{" "}
            <span className="rounded bg-white px-2 py-1 font-semibold">BSC-RAE-REG-NEW</span> use{" "}
            <span className="rounded bg-white px-2 py-1 font-semibold">RAE-REG-SHARED</span>, then
            the curriculum should be imported once and viewed through either identity.
          </p>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">Program / Curriculum</label>
          <select
            value={programCode}
            onChange={(e) => setProgramCode(e.target.value)}
            className="w-full rounded-2xl border px-3 py-2"
          >
            <option value="">Select academic identity</option>
            {programs.map((program) => (
              <option key={program.programCode} value={program.programCode}>
                {program.displayLabel}
              </option>
            ))}
          </select>
        </div>

        {selectedProgramLabel ? (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Selected Academic Identity</p>
              <p className="mt-2 text-sm text-slate-700">{selectedProgramLabel}</p>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Resolved Curriculum Key</p>
              <p className="mt-2 text-sm text-slate-700">{selectedCurriculumKey || "-"}</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Course List</h3>
          <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
            {loading ? "Loading..." : `${courses.length} courses`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Level / Term</th>
                <th className="px-3 py-2">Curriculum Key</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b">
                  <td className="px-3 py-2">{course.courseCode}</td>
                  <td className="px-3 py-2">{course.courseTitle}</td>
                  <td className="px-3 py-2">{course.credit}</td>
                  <td className="px-3 py-2">{course.courseType}</td>
                  <td className="px-3 py-2">{course.groupName || "-"}</td>
                  <td className="px-3 py-2">{course.levelTerm || "-"}</td>
                  <td className="px-3 py-2">{course.curriculumKey || "-"}</td>
                </tr>
              ))}

              {!courses.length && !loading ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={7}>
                    No courses found for the selected academic identity.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
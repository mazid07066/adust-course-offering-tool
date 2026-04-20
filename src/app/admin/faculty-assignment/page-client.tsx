"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type FacultyOption = {
  id: number;
  teacherCode: string;
  fullName: string;
  designation: string | null;
};

type SelectedByFaculty = {
  teacherId: number;
  teacherCode: string;
  teacherName: string;
  designation: string | null;
  status: string;
  priorityOrder: number | null;
  confirmedAt: string | null;
  selectedAt: string | null;
};

type AssignedTeacher = {
  teacherId: number;
  teacherCode: string;
  teacherName: string;
  designation: string | null;
  assignedCredit: number;
  loadType: string;
};

type CourseRow = {
  offeredCourseId: number;
  offeringId: number;
  offeringStatus: string;
  programCode: string;
  programName: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  credit: number;
  batchCodes: string[];
  schedule: Array<{
    id: number;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    roomCode: string;
  }>;
  linkedSecondaryCourses: Array<{
    id: number;
    courseCode: string;
    courseTitle: string;
    section: string;
    programCode: string;
    batchCodes: string[];
  }>;
  assignedTeachers: AssignedTeacher[];
  selectedByFaculties: SelectedByFaculty[];
};

type TeacherLoadSummary = {
  teacherId: number;
  teacherCode: string;
  teacherName: string;
  designation: string | null;
  totalAssignedCredits: number;
  totalAssignedSections: number;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  termName?: string;
  faculties?: FacultyOption[];
  teacherLoadSummary?: TeacherLoadSummary[];
  courses?: CourseRow[];
};

export default function FacultyAssignmentPageClient() {
  const { terms, termName, setTermName, loadingTerms, termError } = useAcademicTerms();

  const [loading, setLoading] = useState(false);
  const [assigningKey, setAssigningKey] = useState("");
  const [unassigningKey, setUnassigningKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [teacherLoadSummary, setTeacherLoadSummary] = useState<TeacherLoadSummary[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selectedFacultyByCourse, setSelectedFacultyByCourse] = useState<Record<number, string>>({});

  async function loadBoard() {
    if (!termName) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/faculty-assignment/options?termName=${encodeURIComponent(termName)}`,
        {
          cache: "no-store",
        }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load faculty assignment board.");
      }

      setFaculties(json.faculties || []);
      setTeacherLoadSummary(json.teacherLoadSummary || []);
      setCourses(json.courses || []);

      const defaults: Record<number, string> = {};
      for (const course of json.courses || []) {
        if (course.assignedTeachers.length > 0) {
          defaults[course.offeredCourseId] = String(course.assignedTeachers[0].teacherId);
        } else if (course.selectedByFaculties.length > 0) {
          defaults[course.offeredCourseId] = String(course.selectedByFaculties[0].teacherId);
        } else {
          defaults[course.offeredCourseId] = "";
        }
      }
      setSelectedFacultyByCourse(defaults);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load faculty assignment board."
      );
      setFaculties([]);
      setTeacherLoadSummary([]);
      setCourses([]);
      setSelectedFacultyByCourse({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (termName) {
      loadBoard();
    }
  }, [termName]);

  const facultyMap = useMemo(() => {
    const map = new Map<number, FacultyOption>();
    for (const faculty of faculties) {
      map.set(faculty.id, faculty);
    }
    return map;
  }, [faculties]);

  async function assignFaculty(offeredCourseId: number) {
    if (!termName) {
      setError("Please select a term first.");
      return;
    }

    const teacherId = Number(selectedFacultyByCourse[offeredCourseId] || "");
    if (!teacherId) {
      setError("Please select a faculty before assignment.");
      return;
    }

    const faculty = facultyMap.get(teacherId);
    const label = faculty
      ? `${faculty.teacherCode} - ${faculty.fullName}`
      : `Faculty ID ${teacherId}`;

    const ok = window.confirm(
      `Assign ${label} to this offered section for ${termName}?`
    );
    if (!ok) return;

    setAssigningKey(String(offeredCourseId));
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/faculty-assignment/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termName,
          offeredCourseId,
          teacherId,
        }),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to assign faculty.");
      }

      setMessage(json.message || "Faculty assigned successfully.");
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign faculty.");
    } finally {
      setAssigningKey("");
    }
  }

  async function unassignFaculty(offeredCourseId: number) {
    if (!termName) {
      setError("Please select a term first.");
      return;
    }

    const ok = window.confirm(
      `Remove current faculty assignment from this offered section for ${termName}?`
    );
    if (!ok) return;

    setUnassigningKey(String(offeredCourseId));
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/admin/faculty-assignment/unassign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          termName,
          offeredCourseId,
        }),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to unassign faculty.");
      }

      setMessage(json.message || "Faculty assignment removed successfully.");
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unassign faculty.");
    } finally {
      setUnassigningKey("");
    }
  }

  return (
    <AdminLayout title="Faculty Assignment">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-md">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Academic Term
              </label>
              <select
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
                disabled={loadingTerms}
              >
                <option value="">
                  {loadingTerms ? "Loading terms..." : "Select Academic Term"}
                </option>
                {terms.map((term) => (
                  <option key={term.name} value={term.name}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={loadBoard}
              disabled={!termName || loading}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh Assignment Board"}
            </button>
          </div>
        </div>

        {(error || termError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || termError}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Faculty Assigned Load Summary
          </h2>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Faculty</th>
                  <th className="border-b px-3 py-3 text-left">Designation</th>
                  <th className="border-b px-3 py-3 text-left">Assigned Sections</th>
                  <th className="border-b px-3 py-3 text-left">Assigned Credits</th>
                </tr>
              </thead>
              <tbody>
                {teacherLoadSummary.map((teacher) => (
                  <tr key={teacher.teacherId}>
                    <td className="border-b px-3 py-2">
                      {teacher.teacherCode} - {teacher.teacherName}
                    </td>
                    <td className="border-b px-3 py-2">{teacher.designation || "-"}</td>
                    <td className="border-b px-3 py-2">{teacher.totalAssignedSections}</td>
                    <td className="border-b px-3 py-2">{teacher.totalAssignedCredits}</td>
                  </tr>
                ))}
                {teacherLoadSummary.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No faculty load summary found for this term.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          {courses.map((course) => {
            const assignedTeacher = course.assignedTeachers[0] || null;
            const assigning = assigningKey === String(course.offeredCourseId);
            const unassigning = unassigningKey === String(course.offeredCourseId);

            return (
              <div
                key={course.offeredCourseId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {course.courseCode} — {course.courseTitle}
                    </h3>
                    <div className="text-sm text-slate-600">
                      Program: {course.programCode}
                    </div>
                    <div className="text-sm text-slate-600">
                      Section: {course.section}
                    </div>
                    <div className="text-sm text-slate-600">
                      Credit: {course.credit}
                    </div>
                    <div className="text-sm text-slate-600">
                      Batches: {course.batchCodes.join(", ") || "-"}
                    </div>
                    <div className="text-sm text-slate-600">
                      Offering Status: {course.offeringStatus}
                    </div>

                    <div className="pt-2 text-sm text-slate-700">
                      <div className="font-medium">Schedule:</div>
                      {course.schedule.length === 0 ? (
                        <div className="text-slate-500">No slot assigned.</div>
                      ) : (
                        <div className="space-y-1">
                          {course.schedule.map((slot) => (
                            <div key={slot.id}>
                              {slot.dayOfWeek} {slot.startTime}-{slot.endTime} | {slot.roomCode}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {course.linkedSecondaryCourses.length > 0 && (
                      <div className="pt-2 text-sm text-slate-700">
                        <div className="font-medium">Linked Secondary Courses:</div>
                        <div className="space-y-1">
                          {course.linkedSecondaryCourses.map((secondary) => (
                            <div key={secondary.id}>
                              {secondary.courseCode} — {secondary.courseTitle} | Sec-
                              {secondary.section} | {secondary.programCode} | Batches:{" "}
                              {secondary.batchCodes.join(", ") || "-"}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-xl space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">
                        Current Assignment
                      </div>
                      <div className="mt-2 text-sm text-slate-700">
                        {assignedTeacher ? (
                          <>
                            {assignedTeacher.teacherCode} - {assignedTeacher.teacherName} |{" "}
                            {assignedTeacher.designation || "-"} | Credit:{" "}
                            {assignedTeacher.assignedCredit}
                          </>
                        ) : (
                          "No faculty assigned yet."
                        )}
                      </div>

                      <div className="mt-4 flex flex-col gap-3 md:flex-row">
                        <select
                          value={selectedFacultyByCourse[course.offeredCourseId] || ""}
                          onChange={(e) =>
                            setSelectedFacultyByCourse((prev) => ({
                              ...prev,
                              [course.offeredCourseId]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl border px-4 py-3"
                        >
                          <option value="">Select Faculty</option>
                          {faculties.map((faculty) => (
                            <option key={faculty.id} value={faculty.id}>
                              {faculty.teacherCode} - {faculty.fullName}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => assignFaculty(course.offeredCourseId)}
                          disabled={
                            assigning ||
                            !selectedFacultyByCourse[course.offeredCourseId]
                          }
                          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {assigning ? "Assigning..." : "Assign / Override"}
                        </button>

                        <button
                          type="button"
                          onClick={() => unassignFaculty(course.offeredCourseId)}
                          disabled={unassigning || !assignedTeacher}
                          className="rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {unassigning ? "Removing..." : "Unassign"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">
                        Faculty Who Chose This Course
                      </div>

                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white">
                            <tr>
                              <th className="border-b px-3 py-3 text-left">Faculty</th>
                              <th className="border-b px-3 py-3 text-left">Status</th>
                              <th className="border-b px-3 py-3 text-left">Priority</th>
                              <th className="border-b px-3 py-3 text-left">Submitted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {course.selectedByFaculties.map((choice) => (
                              <tr key={`${course.offeredCourseId}-${choice.teacherId}`}>
                                <td className="border-b px-3 py-2">
                                  {choice.teacherCode} - {choice.teacherName}
                                </td>
                                <td className="border-b px-3 py-2">{choice.status}</td>
                                <td className="border-b px-3 py-2">
                                  {choice.priorityOrder || "-"}
                                </td>
                                <td className="border-b px-3 py-2">
                                  {choice.status === "FINAL"
                                    ? choice.confirmedAt || "-"
                                    : choice.selectedAt || "-"}
                                </td>
                              </tr>
                            ))}

                            {course.selectedByFaculties.length === 0 && (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-4 py-6 text-center text-slate-500"
                                >
                                  No faculty choices found for this section.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {courses.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              No offered sections found for faculty assignment in the selected term.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
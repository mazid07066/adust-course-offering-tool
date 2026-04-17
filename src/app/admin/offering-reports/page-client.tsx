"use client";

import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import ProgramTermSelector from "@/components/program-term-selector";
import { useAcademicCatalogPrograms } from "@/hooks/use-academic-catalog-programs";
import { useAcademicTerms } from "@/hooks/use-academic-terms";

type Offering = {
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
  offered_courses: Array<{
    id: number;
    section: string;
    master_courses: {
      course_code: string;
      course_title: string;
      credit: number;
      course_type: string;
      group_name: string | null;
      level_term: string | null;
    };
    offered_course_batches: Array<{
      batches: {
        batch_code: string;
      };
    }>;
    offered_course_teachers: Array<{
      teachers: {
        teacher_code: string;
        full_name: string;
      } | null;
    }>;
    offered_course_slots: Array<{
      day_of_week: string;
      start_time: string;
      end_time: string;
      rooms: {
        room_code: string;
      } | null;
    }>;
  }>;
};

type ConfirmedResponse = {
  success?: boolean;
  error?: string;
  offerings?: Offering[];
};

const dayOrder = ["THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "MONDAY"];

export default function OfferingReportsPageClient() {
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [offerings, setOfferings] = useState<Offering[]>([]);

  async function loadConfirmed(e?: React.FormEvent) {
    if (e) e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const params = new URLSearchParams({
        programCode,
        termName,
      });

      const res = await fetch(`/api/offerings/confirmed?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json: ConfirmedResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load confirmed offerings.");
      }

      setOfferings(json.offerings || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load confirmed offerings."
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteConfirmedOffering(offeringId: number) {
    const ok = window.confirm("Delete this confirmed offering?");
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/offerings/confirmed/${offeringId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete confirmed offering.");
      }

      setMessage("Confirmed offering deleted successfully.");
      await loadConfirmed();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete confirmed offering."
      );
    }
  }

  const flatCourses = useMemo(() => {
    return offerings.flatMap((offering) =>
      offering.offered_courses.map((course) => ({
        offeringId: offering.id,
        termName: offering.academic_terms.name,
        programCode: offering.programs.short_name,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        credit: course.master_courses.credit,
        courseType: course.master_courses.course_type,
        section: course.section,
        levelTerm: course.master_courses.level_term,
        groupName: course.master_courses.group_name,
        batches: course.offered_course_batches
          .map((b) => b.batches.batch_code)
          .join(", "),
        faculty: course.offered_course_teachers
          .map((t) => t.teachers?.teacher_code || "-")
          .join(", "),
        slots: course.offered_course_slots,
      }))
    );
  }, [offerings]);

  const scheduleByDay = useMemo(() => {
    const grouped: Record<
      string,
      Array<{
        offeringId: number;
        courseCode: string;
        courseTitle: string;
        section: string;
        faculty: string;
        batches: string;
        room: string;
        start: string;
        end: string;
        slotType: string;
      }>
    > = {};

    for (const day of dayOrder) {
      grouped[day] = [];
    }

    for (const course of flatCourses) {
      for (const slot of course.slots) {
        const day = String(slot.day_of_week || "").toUpperCase();
        if (!grouped[day]) grouped[day] = [];

        grouped[day].push({
          offeringId: course.offeringId,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          section: course.section,
          faculty: course.faculty,
          batches: course.batches,
          room: slot.rooms?.room_code || "-",
          start: slot.start_time,
          end: slot.end_time,
          slotType: "CLASS",
        });
      }
    }

    for (const day of Object.keys(grouped)) {
      grouped[day].sort((a, b) => a.start.localeCompare(b.start));
    }

    return grouped;
  }, [flatCourses]);

  const combinedError = error || programError || termError;

  return (
    <AdminLayout title="Confirmed Offering Reports">
      <div className="space-y-6">
        <form onSubmit={loadConfirmed} className="space-y-4">
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
              disabled={loading || !programCode || !termName}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Reports"}
            </button>

            <a
              href={`/api/export/offered-courses?programCode=${encodeURIComponent(
                programCode
              )}&termName=${encodeURIComponent(termName)}`}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Download Offered Courses Excel
            </a>

            <a
              href={`/api/export/schedule?programCode=${encodeURIComponent(
                programCode
              )}&termName=${encodeURIComponent(termName)}`}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Download Schedule Excel
            </a>
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

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Confirmed Offerings</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {offerings.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Offered Courses</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {flatCourses.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Program</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {programCode || "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Term</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {termName || "-"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {offerings.map((offering) => (
            <div
              key={offering.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {offering.programs.short_name} — {offering.academic_terms.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Offering ID: {offering.id} | Status: {offering.status}
                  </p>
                </div>

                <button
                  onClick={() => deleteConfirmedOffering(offering.id)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete Confirmed Offering
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-3 text-left">Course</th>
                      <th className="border-b px-3 py-3 text-left">Section</th>
                      <th className="border-b px-3 py-3 text-left">Credit</th>
                      <th className="border-b px-3 py-3 text-left">Type</th>
                      <th className="border-b px-3 py-3 text-left">Batches</th>
                      <th className="border-b px-3 py-3 text-left">Faculty</th>
                      <th className="border-b px-3 py-3 text-left">Meetings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offering.offered_courses.map((course) => (
                      <tr key={course.id}>
                        <td className="border-b px-3 py-2">
                          {course.master_courses.course_code} —{" "}
                          {course.master_courses.course_title}
                        </td>
                        <td className="border-b px-3 py-2">{course.section}</td>
                        <td className="border-b px-3 py-2">
                          {course.master_courses.credit}
                        </td>
                        <td className="border-b px-3 py-2">
                          {course.master_courses.course_type}
                        </td>
                        <td className="border-b px-3 py-2">
                          {course.offered_course_batches
                            .map((b) => b.batches.batch_code)
                            .join(", ")}
                        </td>
                        <td className="border-b px-3 py-2">
                          {course.offered_course_teachers
                            .map((t) => t.teachers?.teacher_code || "-")
                            .join(", ")}
                        </td>
                        <td className="border-b px-3 py-2">
                          {course.offered_course_slots
                            .map(
                              (slot) =>
                                `${slot.day_of_week} ${slot.start_time}-${slot.end_time} (${slot.rooms?.room_code || "-"})`
                            )
                            .join(" | ")}
                        </td>
                      </tr>
                    ))}

                    {offering.offered_courses.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-6 text-center text-slate-500"
                        >
                          No courses found in this offering.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {offerings.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              No confirmed offerings loaded yet.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Day-wise Schedule View
          </h3>

          <div className="space-y-6">
            {dayOrder.map((day) => (
              <div key={day}>
                <h4 className="mb-3 text-base font-semibold text-slate-800">
                  {day}
                </h4>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="border-b px-3 py-3 text-left">Course</th>
                        <th className="border-b px-3 py-3 text-left">Section</th>
                        <th className="border-b px-3 py-3 text-left">Time</th>
                        <th className="border-b px-3 py-3 text-left">Room</th>
                        <th className="border-b px-3 py-3 text-left">Faculty</th>
                        <th className="border-b px-3 py-3 text-left">Batches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(scheduleByDay[day] || []).map((row, idx) => (
                        <tr key={`${day}-${idx}`}>
                          <td className="border-b px-3 py-2">
                            {row.courseCode} — {row.courseTitle}
                          </td>
                          <td className="border-b px-3 py-2">{row.section}</td>
                          <td className="border-b px-3 py-2">
                            {row.start} - {row.end}
                          </td>
                          <td className="border-b px-3 py-2">{row.room}</td>
                          <td className="border-b px-3 py-2">{row.faculty}</td>
                          <td className="border-b px-3 py-2">{row.batches}</td>
                        </tr>
                      ))}

                      {(scheduleByDay[day] || []).length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-6 text-center text-slate-500"
                          >
                            No scheduled classes for this day.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
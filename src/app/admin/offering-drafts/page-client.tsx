"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin-layout";

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
  offered_courses: Array<{
    id: number;
    section: string;
    master_courses: {
      course_code: string;
      course_title: string;
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

export default function OfferingDraftsPageClient() {
  const [programCode, setProgramCode] = useState("BSC-RAE");
  const [termName, setTermName] = useState("SUMMER 2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);

  async function loadDrafts(e?: React.FormEvent) {
    if (e) e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const params = new URLSearchParams({
        programCode,
        termName,
      });

      const res = await fetch(`/api/offerings/drafts?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load draft offerings.");
      }

      setDrafts(json.drafts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load draft offerings.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDraft(id: number) {
    const ok = window.confirm("Delete this draft offering?");
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/offerings/drafts/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete draft offering.");
      }

      setMessage("Draft offering deleted successfully.");
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete draft offering.");
    }
  }

  async function publishDraft(id: number) {
    const ok = window.confirm("Publish this draft offering?");
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/offerings/drafts/${id}/publish`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to publish draft offering.");
      }

      setMessage("Draft offering published successfully.");
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish draft offering.");
    }
  }

  return (
    <AdminLayout title="Draft Offerings">
      <div className="space-y-6">
        <form onSubmit={loadDrafts} className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Program Code
            </label>
            <input
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border px-4 py-3"
              placeholder="BSC-RAE"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Academic Term
            </label>
            <input
              value={termName}
              onChange={(e) => setTermName(e.target.value.toUpperCase())}
              className="w-full rounded-xl border px-4 py-3"
              placeholder="SUMMER 2026"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load Drafts"}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="space-y-4">
          {drafts.map((draft) => (
            <div key={draft.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {draft.programs.short_name} — {draft.academic_terms.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Draft ID: {draft.id} | Status: {draft.status}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => publishDraft(draft.id)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Publish Draft
                  </button>

                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete Draft
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-3 text-left">Course</th>
                      <th className="border-b px-3 py-3 text-left">Section</th>
                      <th className="border-b px-3 py-3 text-left">Batches</th>
                      <th className="border-b px-3 py-3 text-left">Faculty</th>
                      <th className="border-b px-3 py-3 text-left">Schedule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.offered_courses.map((course) => (
                      <tr key={course.id}>
                        <td className="border-b px-3 py-2">
                          {course.master_courses.course_code} — {course.master_courses.course_title}
                        </td>
                        <td className="border-b px-3 py-2">{course.section}</td>
                        <td className="border-b px-3 py-2">
                          {course.offered_course_batches.map((b) => b.batches.batch_code).join(", ")}
                        </td>
                        <td className="border-b px-3 py-2">
                          {course.offered_course_teachers
                            .map((t) => t.teachers?.teacher_code || "-")
                            .join(", ")}
                        </td>
                        <td className="border-b px-3 py-2">
                          {course.offered_course_slots.map((s, i) => (
                            <div key={i}>
                              {s.day_of_week} {s.start_time}-{s.end_time} ({s.rooms?.room_code || "-"})
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {drafts.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              No draft offerings found for the selected program and term.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
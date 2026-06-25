"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DashboardSummary = {
  total_tasks: number;
  completed_tasks: number;
  submitted_tasks: number;
  needs_revision_tasks: number;
  verified_tasks: number;
  overdue_tasks: number;
  critical_open_tasks: number;
  unassigned_tasks: number;
};

type EvidenceSummary = {
  total_evidence: number;
  pending_review: number;
  done_reviews: number;
  requires_update: number;
  needs_modification: number;
};

type ModuleSummary = {
  module_code: string;
  module_title: string;
  route_path: string | null;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  pending_review_tasks: number;
};

type CommitteeSummary = {
  committee_code: string;
  committee_name: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  pending_review_tasks: number;
};

export default function BaeteDashboardAlerts() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [evidence, setEvidence] = useState<EvidenceSummary | null>(null);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [committees, setCommittees] = useState<CommitteeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/accreditation/dashboard", {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load dashboard.");
      }

      setSummary(json.summary || null);
      setEvidence(json.evidence || null);
      setModules(json.modules || []);
      setCommittees(json.committees || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const completionPercent = useMemo(() => {
    if (!summary || summary.total_tasks === 0) return 0;
    return Math.round((summary.completed_tasks / summary.total_tasks) * 100);
  }, [summary]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading BAETE live dashboard...
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
        {error}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/admin/accreditation/my-tasks"
          className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm"
        >
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            Overall Completion
          </div>
          <div className="mt-3 text-4xl font-black text-blue-900">
            {completionPercent}%
          </div>
          <div className="mt-2 text-sm text-blue-800">
            {summary?.completed_tasks || 0} of {summary?.total_tasks || 0} tasks
          </div>
        </Link>

        <Link
          href="/admin/accreditation/review-queue"
          className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm"
        >
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
            Pending Evidence Review
          </div>
          <div className="mt-3 text-4xl font-black text-violet-900">
            {evidence?.pending_review || 0}
          </div>
          <div className="mt-2 text-sm text-violet-800">
            Uploaded files waiting for decision
          </div>
        </Link>

        <Link
          href="/admin/accreditation/overdue"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm"
        >
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">
            Overdue Tasks
          </div>
          <div className="mt-3 text-4xl font-black text-red-900">
            {summary?.overdue_tasks || 0}
          </div>
          <div className="mt-2 text-sm text-red-800">
            Past due and not completed
          </div>
        </Link>

        <Link
          href="/admin/accreditation/committee-board"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
        >
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
            Needs Revision
          </div>
          <div className="mt-3 text-4xl font-black text-amber-900">
            {summary?.needs_revision_tasks || 0}
          </div>
          <div className="mt-2 text-sm text-amber-800">
            Tasks returned with feedback
          </div>
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-serif text-2xl text-slate-950">
              Module Alerts
            </h3>
            <button
              type="button"
              onClick={loadData}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {modules.map((item) => {
              const percent =
                item.total_tasks === 0
                  ? 0
                  : Math.round((item.completed_tasks / item.total_tasks) * 100);

              return (
                <Link
                  key={item.module_code}
                  href={item.route_path || "/admin/accreditation"}
                  className="block rounded-xl border border-slate-200 p-4 hover:border-blue-300"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-950">
                        {item.module_title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.completed_tasks}/{item.total_tasks} completed ·{" "}
                        {item.pending_review_tasks} pending review ·{" "}
                        {item.overdue_tasks} overdue
                      </div>
                    </div>
                    <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">
                      {percent}%
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-serif text-2xl text-slate-950">
            Committee Alerts
          </h3>

          <div className="mt-4 space-y-3">
            {committees.map((item) => {
              const percent =
                item.total_tasks === 0
                  ? 0
                  : Math.round((item.completed_tasks / item.total_tasks) * 100);

              return (
                <div
                  key={item.committee_code}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-950">
                        {item.committee_code} — {item.committee_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.completed_tasks}/{item.total_tasks} completed ·{" "}
                        {item.pending_review_tasks} pending review ·{" "}
                        {item.overdue_tasks} overdue
                      </div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                      {percent}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

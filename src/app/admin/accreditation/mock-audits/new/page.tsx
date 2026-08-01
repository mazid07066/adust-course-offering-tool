import Link from "next/link";
import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import { baeteSession } from "@/lib/baete-static-data";

export default async function NewMockAuditPage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="Create Mock Audit Session"
      phaseLabel="Phase 1"
      subtitle="Create a new accreditation review session. Persistence will be activated in Phase 2."
    >
      <div className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="font-serif text-3xl text-slate-950">Session details</h2>
        <p className="mt-2 text-slate-600">You can update these later from the session record.</p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Session name</span>
            <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 shadow-sm" defaultValue={baeteSession.name} />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Academic year / semester</span>
            <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 shadow-sm" defaultValue={baeteSession.academicYear} />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Session coordinator</span>
            <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 shadow-sm" defaultValue={baeteSession.coordinator} />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Review deadline</span>
            <input type="date" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 shadow-sm" defaultValue={baeteSession.deadline} />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Audit scope</span>
            <textarea className="mt-2 h-28 w-full rounded-xl border border-slate-300 px-4 py-3 shadow-sm" defaultValue={baeteSession.scope} />
          </label>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Phase 1 visual shell only. The Create Session button will become database-backed in Phase 2.
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">
              Create session
            </button>
            <Link href="/admin/accreditation/mock-audits" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </BaeteWorkspaceShell>
  );
}

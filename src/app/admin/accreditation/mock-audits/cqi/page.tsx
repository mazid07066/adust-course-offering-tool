import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import { baeteSession, cqiActions } from "@/lib/baete-static-data";

export default async function CqiTrackingPage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="Continuous Quality Improvement"
      phaseLabel="Phase 4 & 5"
      subtitle="AI-style recommendations and progress tracking for improvement actions."
    >
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm" defaultValue={baeteSession.name}>
          <option>{baeteSession.name}</option>
        </select>
        <button type="button" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">
          Generate recommendations
        </button>
      </div>

      <div className="space-y-5">
        {cqiActions.map((action) => (
          <section key={action.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.3em] text-amber-500">{action.criterion}</div>
                <h2 className="mt-2 font-serif text-2xl text-slate-950">{action.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{action.description}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{action.status}</span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Timeline</div>
                <p className="mt-2 text-sm font-medium">{action.timeline}</p>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Resources</div>
                <p className="mt-2 text-sm font-medium">{action.resources}</p>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Success Metric</div>
                <p className="mt-2 text-sm font-medium">{action.successMetric}</p>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Implementation Steps</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {action.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Status</span>
                <select className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" defaultValue={action.status}>
                  <option>Planned</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Verified</option>
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Progress</span>
                <div className="mt-2 flex items-center gap-3">
                  <input type="range" min="0" max="100" defaultValue={action.progress} className="w-full" />
                  <span className="text-sm font-semibold">{action.progress}%</span>
                </div>
              </label>
            </div>
          </section>
        ))}
      </div>
    </BaeteWorkspaceShell>
  );
}

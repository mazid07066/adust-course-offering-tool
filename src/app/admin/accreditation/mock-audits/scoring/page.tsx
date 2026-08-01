import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import { baeteCriteria, baeteSession, getSeverity } from "@/lib/baete-static-data";

export default async function CriterionScoringPage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="Criterion Scoring"
      phaseLabel="Phase 2"
      subtitle="Score each criterion on a 0–5 scale with evidence and justification."
    >
      <div className="mb-6 flex justify-end">
        <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm" defaultValue={baeteSession.name}>
          <option>{baeteSession.name}</option>
        </select>
      </div>

      <div className="space-y-5">
        {baeteCriteria.map((criterion) => (
          <section key={criterion.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl text-slate-950">{criterion.title}</h2>
                <p className="text-sm text-slate-600">{criterion.description}</p>
              </div>
              <div className="text-right">
                <div className="font-serif text-4xl">{criterion.score.toFixed(1)}</div>
                <div className="text-xs text-slate-500">{getSeverity(criterion.score)}</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-xs text-slate-500">
                <span>0 None</span>
                <span>5 Excellent</span>
              </div>
              <input type="range" min="0" max="5" step="0.1" defaultValue={criterion.score} className="w-full" />
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Justification / Observations</span>
              <textarea className="mt-2 h-20 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" defaultValue={criterion.observation} />
            </label>

            <div className="mt-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Supporting Evidence</div>
              <div className="mt-2 flex gap-2">
                <input className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm" defaultValue={criterion.evidence[0]} />
                <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">+ Add</button>
              </div>
            </div>
          </section>
        ))}

        <div className="sticky bottom-4 flex justify-end">
          <button type="button" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg">
            Save & continue
          </button>
        </div>
      </div>
    </BaeteWorkspaceShell>
  );
}

import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import {
  baeteCriteria,
  baeteSession,
  calculateAverageScore,
  cqiActions,
  getOpenDeficiencies,
  getSeverity,
  getVerdict,
} from "@/lib/baete-static-data";

export default async function AuditReportPage() {
  await requireCoordinatorOrAdmin();

  const average = calculateAverageScore();
  const deficiencies = getOpenDeficiencies();

  return (
    <BaeteWorkspaceShell
      title="Audit Report"
      phaseLabel="Phase 6"
      subtitle="Professional audit report with findings and recommendations."
    >
      <div className="mb-6 flex flex-wrap justify-end gap-3">
        <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm" defaultValue={baeteSession.name}>
          <option>{baeteSession.name}</option>
        </select>
        <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm">Print</button>
        <button type="button" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Export</button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-amber-500">
          BAETE 3.0 Mock Audit · EEE Program
        </div>
        <h2 className="mt-2 font-serif text-4xl text-slate-950">{baeteSession.name}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {baeteSession.academicYear} · Coordinator: {baeteSession.coordinator} · Deadline: {baeteSession.deadline}
        </p>

        <hr className="my-6" />

        <h3 className="font-serif text-2xl text-slate-950">Executive summary</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Overall Readiness Score</div>
            <div className="mt-2 font-serif text-3xl">{average} / 5.0</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Verdict</div>
            <div className="mt-2 font-serif text-3xl">{getVerdict(average)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Open Deficiencies</div>
            <div className="mt-2 font-serif text-3xl">{deficiencies.length}</div>
          </div>
        </div>

        <p className="mt-4 text-sm font-medium text-slate-800">
          Good readiness. Recommended action: address minor gaps and document closed-loop CQI before external review.
        </p>

        <h3 className="mt-8 font-serif text-2xl text-slate-950">Criterion findings</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {baeteCriteria.map((criterion) => (
            <div key={criterion.title} className="flex items-start justify-between gap-4 py-4">
              <div>
                <div className="font-bold">{criterion.title}</div>
                <div className="mt-1 text-sm text-slate-600">{criterion.observation}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-serif text-2xl">{criterion.score.toFixed(1)}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{getSeverity(criterion.score)}</span>
              </div>
            </div>
          ))}
        </div>

        <h3 className="mt-8 font-serif text-2xl text-slate-950">CQI actions</h3>
        <div className="mt-4 space-y-3">
          {cqiActions.map((action) => (
            <div key={action.title} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-bold">{action.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{action.description}</p>
                  <div className="mt-2 text-xs text-slate-500">Timeline: {action.timeline} · Progress: {action.progress}%</div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{action.status}</span>
              </div>
            </div>
          ))}
        </div>

        <hr className="my-6" />
        <div className="text-xs text-slate-500">
          Generated 6/25/2026 · BAETE 3.0 Mock Audit Simulation Tool
        </div>
      </section>
    </BaeteWorkspaceShell>
  );
}

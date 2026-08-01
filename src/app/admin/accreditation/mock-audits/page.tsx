import Link from "next/link";
import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import {
  baeteCriteria,
  baeteSession,
  calculateAverageScore,
  getOpenDeficiencies,
  getSeverity,
  getVerdict,
} from "@/lib/baete-static-data";

export default async function MockAuditsPage() {
  await requireCoordinatorOrAdmin();

  const average = calculateAverageScore();
  const deficiencies = getOpenDeficiencies();

  return (
    <BaeteWorkspaceShell
      title="Mock Audit Dashboard"
      phaseLabel="Accreditation Readiness"
      subtitle={`${baeteSession.name} · ${baeteSession.academicYear}`}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Overall Readiness", `${average} / 5.0`, getVerdict(average)],
            ["Criteria Assessed", `${baeteCriteria.length}/${baeteCriteria.length}`, "Complete"],
            ["Open Deficiencies", String(deficiencies.length), "Needs action"],
            ["CQI Actions", "4", "Planned"],
          ].map(([title, value, note]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">{title}</div>
              <div className="mt-4 font-serif text-4xl text-slate-950">{value}</div>
              <div className="mt-3 text-sm font-medium text-emerald-700">{note}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <h2 className="font-serif text-2xl text-slate-950">Criterion radar</h2>
            <p className="mt-1 text-sm text-slate-600">Performance across all BAETE 3.0 criteria</p>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              {baeteCriteria.map((criterion) => (
                <div key={criterion.title} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{criterion.title}</div>
                      <div className="text-xs text-slate-500">{criterion.description}</div>
                    </div>
                    <div className="font-serif text-3xl">{criterion.score.toFixed(1)}</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-amber-400" style={{ width: `${criterion.score * 20}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl text-slate-950">Deficiency mix</h2>
            <p className="mt-1 text-sm text-slate-600">By severity</p>
            <div className="mt-8 flex h-52 items-center justify-center rounded-full border-[34px] border-amber-400 text-center">
              <div>
                <div className="text-xs font-semibold text-slate-500">Minor</div>
                <div className="text-3xl font-bold">{deficiencies.length}</div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-xs">
              <span>🔴 Critical: 0</span>
              <span>🟠 Major: 1</span>
              <span>🟡 Minor: 3</span>
              <span>🟢 Healthy: 3</span>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-serif text-2xl text-slate-950">Criterion summary</h2>
              <p className="mt-1 text-sm text-slate-600">Quick view of all criterion scores</p>
            </div>
            <Link href="/admin/accreditation/mock-audits/scoring" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm">
              Open scoring →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {baeteCriteria.map((criterion) => (
              <div key={criterion.title} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                <div>
                  <div className="font-bold text-slate-900">{criterion.title}</div>
                  <div className="text-xs text-slate-500">{criterion.description}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-2xl">{criterion.score.toFixed(1)}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{getSeverity(criterion.score)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </BaeteWorkspaceShell>
  );
}

import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import { baeteCriteria, calculateAverageScore } from "@/lib/baete-static-data";

export default async function AccreditationAnalyticsPage() {
  await requireCoordinatorOrAdmin();

  const average = calculateAverageScore();

  return (
    <BaeteWorkspaceShell
      title="Historical Analytics"
      phaseLabel="Phase 7"
      subtitle="Trend analysis across audit sessions."
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl text-slate-950">ORS progression</h2>
          <p className="mt-1 text-sm text-slate-600">Overall Readiness Score across sessions</p>
          <div className="mt-8 h-56 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <div className="flex h-full items-end gap-8">
              <div className="flex flex-1 flex-col items-center">
                <div className="h-28 w-4 rounded-t bg-slate-950" />
                <div className="mt-2 text-xs">Spring 2024 Self-A</div>
              </div>
              <div className="flex flex-1 flex-col items-center">
                <div className="h-40 w-4 rounded-t bg-amber-400" />
                <div className="mt-2 text-xs">Spring 2026 Accred</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl text-slate-950">Criterion movement</h2>
          <div className="mt-5 space-y-4">
            {baeteCriteria.slice(0, 5).map((criterion) => (
              <div key={criterion.title}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{criterion.title}</span>
                  <span>{criterion.score.toFixed(1)} / 5</span>
                </div>
                <div className="h-3 rounded-full bg-slate-200">
                  <div className="h-3 rounded-full bg-amber-400" style={{ width: `${criterion.score * 20}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Sessions Recorded</div>
            <div className="mt-4 font-serif text-5xl">2</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Avg ORS</div>
            <div className="mt-4 font-serif text-5xl">{average.toFixed(2)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Improvement Δ</div>
            <div className="mt-4 font-serif text-5xl">0.60</div>
          </div>
        </div>
      </div>
    </BaeteWorkspaceShell>
  );
}

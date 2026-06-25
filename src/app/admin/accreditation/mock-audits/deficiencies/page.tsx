import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import { baeteSession, getOpenDeficiencies, getVerdict } from "@/lib/baete-static-data";

export default async function DeficienciesPage() {
  await requireCoordinatorOrAdmin();

  const deficiencies = getOpenDeficiencies();

  return (
    <BaeteWorkspaceShell
      title="Identified Deficiencies"
      phaseLabel="Phase 3"
      subtitle="Auto-flagged where score < 3.6, with severity classification."
    >
      <div className="mb-6 flex justify-end">
        <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm" defaultValue={baeteSession.name}>
          <option>{baeteSession.name}</option>
        </select>
      </div>

      <div className="space-y-5">
        {deficiencies.map((criterion) => (
          <section key={criterion.title} className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="font-serif text-3xl text-slate-950">⚠ {criterion.title}</h2>
                <p className="mt-2 text-slate-600">
                  {criterion.score < 3 ? "Significant issues requiring substantial work." : "Small gaps, easily addressable."}
                </p>
              </div>
              <div className="text-right">
                <div className="font-serif text-4xl">{criterion.score.toFixed(1)}</div>
                <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-800">
                  {getVerdict(criterion.score)}
                </span>
              </div>
            </div>

            <p className="mt-8 text-base text-slate-900">{criterion.observation}</p>
          </section>
        ))}
      </div>
    </BaeteWorkspaceShell>
  );
}

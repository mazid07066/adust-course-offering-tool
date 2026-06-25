import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import { roadmapTimeline, graduateAttributes, deficiencyTriggers } from "@/lib/baete-static-data";

export default async function AccreditationRoadmapPage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="BAETE Readiness Roadmap"
      phaseLabel="Accreditation Readiness"
      subtitle="24-month implementation cycle, 104-week controlled plan, prerequisites, documents, and evidence readiness."
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl text-slate-950">24-Month Accreditation Roadmap</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-5">
            {roadmapTimeline.map((item, index) => (
              <div key={item.phase} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173f78] text-sm font-bold text-white">
                  {index + 1}
                </div>
                <div className="mt-4 text-sm font-bold text-slate-950">{item.phase}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{item.period}</div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{item.focus}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl text-slate-950">Prerequisite Readiness</h2>
            <div className="mt-4 space-y-3">
              {[
                "CO-PO mapping completed and verified",
                "Course files preserved semester-wise",
                "Question papers mapped with Bloom taxonomy",
                "Lab safety and equipment evidence indexed",
                "CQI action history documented with before/after data",
                "Industry and stakeholder engagement records collected",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  ✅ {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl text-slate-950">Deficiency Watchlist</h2>
            <div className="mt-4 space-y-3">
              {deficiencyTriggers.map((item) => (
                <div key={item.issue} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <span>{item.issue}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{item.severity}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-2xl text-slate-950">Graduate Attribute Coverage</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">PO</th>
                  <th className="px-4 py-3 text-left">Attribute</th>
                  <th className="px-4 py-3 text-left">BAETE Code</th>
                  <th className="px-4 py-3 text-left">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {graduateAttributes.map(([po, attribute, code, evidence]) => (
                  <tr key={po} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-bold">{po}</td>
                    <td className="px-4 py-3">{attribute}</td>
                    <td className="px-4 py-3">{code}</td>
                    <td className="px-4 py-3">{evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </BaeteWorkspaceShell>
  );
}

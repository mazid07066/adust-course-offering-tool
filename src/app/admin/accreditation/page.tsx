import Link from "next/link";
import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import {
  baeteCriteria,
  calculateWeightedOrs,
  deficiencyTriggers,
  graduateAttributes,
  roadmapTimeline,
} from "@/lib/baete-static-data";

export default async function AccreditationWorkspacePage() {
  await requireCoordinatorOrAdmin();

  const ors = calculateWeightedOrs();

  return (
    <BaeteWorkspaceShell
      title="ADUST EEE — BAETE Accreditation Readiness Report"
      subtitle="Electrical & Electronic Engineering Program | Outcome-Based Education (OBE) Integrated Accreditation System | Version 3.0"
    >
      <div className="space-y-6">
        <section className="rounded-2xl bg-[#173f78] p-6 text-white shadow-sm">
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-4 py-2">24-Month Implementation Cycle</span>
            <span className="rounded-full bg-white/15 px-4 py-2">104-Week Controlled Plan</span>
            <span className="rounded-full bg-emerald-500/40 px-4 py-2">Current: Semester 1 Cohort Active</span>
            <span className="rounded-full bg-amber-500/40 px-4 py-2">Mock Audit: Month 18</span>
            <span className="rounded-full bg-white/15 px-4 py-2">Washington Accord Aligned</span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">
            Overall Accreditation Readiness Score (ORS) — Target Framework
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            {baeteCriteria.filter((criterion) => criterion.weight > 0).map((criterion) => (
              <div key={criterion.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="h-1 rounded-full bg-blue-600" />
                <div className="mt-6 text-center text-sm font-semibold text-slate-700">
                  {criterion.key} - {criterion.title}
                </div>
                <div className="mt-1 text-center text-xs text-slate-500">
                  Weight: {criterion.weight}%
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-[#142e63] p-6 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold">ORS Formula</div>
                <div className="mt-2 font-mono text-sm">
                  ORS = ((C1×0.25)+(C2×0.20)+(C3×0.15)+(C4×0.15)+(C5×0.15)+(C6×0.10))×20
                </div>
                <div className="mt-4 inline-flex rounded-full bg-yellow-400 px-5 py-2 text-sm font-black text-slate-950">
                  TARGET: ORS ≥ 80 = BAETE READY
                </div>
              </div>

              <div className="text-sm leading-6 text-blue-100">
                <div className="font-semibold text-white">Current Static ORS: {ors}</div>
                <div>≥80 → Ready</div>
                <div>65–79 → Minor fixes</div>
                <div>50–64 → Major issues</div>
                <div>&lt;50 → Not ready</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-950">Program Timeline Summary</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#173f78] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Phase</th>
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-left">Focus</th>
                  </tr>
                </thead>
                <tbody>
                  {roadmapTimeline.map((item) => (
                    <tr key={item.phase} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-semibold">{item.phase}</td>
                      <td className="px-4 py-3">{item.period}</td>
                      <td className="px-4 py-3">{item.focus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-950">Critical Deficiency Triggers</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#173f78] text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Issue</th>
                    <th className="px-4 py-3 text-left">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {deficiencyTriggers.map((item) => (
                    <tr key={item.issue} className="border-b border-slate-100">
                      <td className="px-4 py-3">{item.issue}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          item.severity === "CRITICAL"
                            ? "bg-red-100 text-red-700"
                            : item.severity === "MAJOR"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-green-100 text-green-700"
                        }`}>
                          {item.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">
            CQI Closed-Loop Requirements (CRITICAL — Must Prove to Auditors)
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Step 1: DETECT", "Measure CO attainment per course per semester. Identify COs below threshold."],
              ["Step 2: DIAGNOSE", "Root cause analysis. Was it teaching quality, content coverage, assessment design, or engagement?"],
              ["Step 3: ACT", "Apply corrective action. Document the specific intervention with timeline, responsible faculty, and method."],
              ["Step 4: VALIDATE", "Re-measure next offering. Show before/after data. Without this, CQI is incomplete."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="font-bold text-slate-900">{title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
            CQI Failure Conditions: No before/after comparison = FAKE CQI | No corrective action = LOOP FAILURE | No re-measurement = INACTIVE CQI.
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">
            Washington Accord Graduate Attributes — PO Coverage Required
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#173f78] text-white">
                <tr>
                  <th className="px-4 py-3 text-left">PO</th>
                  <th className="px-4 py-3 text-left">Graduate Attribute</th>
                  <th className="px-4 py-3 text-left">BAETE Code</th>
                  <th className="px-4 py-3 text-left">Assessment Evidence</th>
                </tr>
              </thead>
              <tbody>
                {graduateAttributes.map(([po, attribute, code, evidence]) => (
                  <tr key={po} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-semibold">{po}</td>
                    <td className="px-4 py-3">{attribute}</td>
                    <td className="px-4 py-3">{code}</td>
                    <td className="px-4 py-3">{evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/admin/accreditation/mock-audits" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            Open Mock Audit Dashboard
          </Link>
          <Link href="/admin/accreditation/mock-audits/new" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            Create New Audit Session
          </Link>
        </div>
      </div>
    </BaeteWorkspaceShell>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type BaeteWorkspaceShellProps = {
  title?: string;
  phaseLabel?: string;
  subtitle?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/admin/accreditation", label: "Home", icon: "⌂" },
  { href: "/admin/accreditation/roadmap", label: "Roadmap", icon: "▥" },
  { href: "/admin/accreditation/mock-audits", label: "Dashboard", icon: "▦" },
  { href: "/admin/accreditation/mock-audits/new", label: "New Audit", icon: "＋" },
  { href: "/admin/accreditation/mock-audits/scoring", label: "Criterion Scoring", icon: "☑" },
  { href: "/admin/accreditation/mock-audits/deficiencies", label: "Deficiencies", icon: "△" },
  { href: "/admin/accreditation/mock-audits/cqi", label: "CQI Tracking", icon: "⚙" },
  { href: "/admin/accreditation/mock-audits/report", label: "Audit Reports", icon: "▤" },
  { href: "/admin/accreditation/analytics", label: "Analytics", icon: "⌁" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BaeteWorkspaceShell({
  title = "BAETE 3.0 Accreditation Workspace",
  phaseLabel,
  subtitle,
  children,
}: BaeteWorkspaceShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 bg-slate-950 text-white xl:block">
          <div className="sticky top-0 h-screen overflow-y-auto px-5 py-6">
            <Link href="/admin/accreditation" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-slate-950">
                B
              </div>
              <div>
                <div className="font-bold">BAETE 3.0</div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                  Mock Audit Tool
                </div>
              </div>
            </Link>

            <div className="mt-8 border-t border-slate-800 pt-6">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Workspace
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const active = isActive(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                        active
                          ? "bg-slate-800 text-white"
                          : "text-slate-200 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      <span className="w-5 text-center text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs leading-6 text-slate-300">
              <div className="font-semibold text-white">Integrated with UniFlow</div>
              <p className="mt-2">
                Static workspace shell now. Database-backed sessions, scoring,
                CQI, and reports begin in Phase 2.
              </p>
              <Link
                href="/admin"
                className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-950"
              >
                Back to UniFlow
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-[#fbfaf6]">
            <div className="px-5 py-5 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                    EEE Program · Accreditation Workspace
                  </div>
                  {phaseLabel ? (
                    <div className="mt-8 text-xs font-bold uppercase tracking-[0.35em] text-amber-500">
                      {phaseLabel}
                    </div>
                  ) : null}
                  <h1 className="mt-2 font-serif text-4xl text-slate-950">
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {subtitle}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/admin/accreditation/mock-audits"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Mock Dashboard
                  </Link>
                  <Link
                    href="/admin/accreditation/mock-audits/scoring"
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Open Scoring
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <section className="px-5 py-8 lg:px-8">{children}</section>
        </main>
      </div>
    </div>
  );
}

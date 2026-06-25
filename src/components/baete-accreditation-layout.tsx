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

const navGroups = [
  {
    title: "Original Mock Audit Tool",
    items: [
      { href: "/admin/accreditation", label: "Home", icon: "⌂" },
      { href: "/admin/accreditation/roadmap", label: "Roadmap", icon: "▥" },
      { href: "/admin/accreditation/mock-audits", label: "Dashboard", icon: "▦" },
      { href: "/admin/accreditation/mock-audits/new", label: "New Audit", icon: "＋" },
      { href: "/admin/accreditation/mock-audits/scoring", label: "Criterion Scoring", icon: "☑" },
      { href: "/admin/accreditation/mock-audits/deficiencies", label: "Deficiencies", icon: "△" },
      { href: "/admin/accreditation/mock-audits/cqi", label: "CQI Tracking", icon: "⚙" },
      { href: "/admin/accreditation/mock-audits/report", label: "Audit Reports", icon: "▤" },
      { href: "/admin/accreditation/analytics", label: "Analytics", icon: "⌁" },
    ],
  },
  {
    title: "Dynamic Readiness Modules",
    items: [
      { href: "/admin/accreditation/roadmap/gantt", label: "24-Month Gantt", icon: "▦" },
      { href: "/admin/accreditation/roadmap/weekly-plan", label: "Weekly Plan", icon: "▤" },
      { href: "/admin/accreditation/prerequisites", label: "Prerequisites", icon: "☑" },
      { href: "/admin/accreditation/documentation", label: "Documentation", icon: "▥" },
      { href: "/admin/accreditation/mock-audit-18-month", label: "18-Month Mock Audit", icon: "⌕" },
    ],
  },
  {
    title: "Work Queue",
    items: [
      { href: "/admin/accreditation/my-tasks", label: "My BAETE Tasks", icon: "◉" },
      { href: "/admin/accreditation/committee-board", label: "Committee Board", icon: "▧" },
      { href: "/admin/accreditation/review-queue", label: "Review Queue", icon: "◇" },
      { href: "/admin/accreditation/overdue", label: "Overdue Tasks", icon: "!" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/admin/accreditation/settings", label: "Settings & Configuration", icon: "⚙" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin/accreditation") {
    return pathname === "/admin/accreditation";
  }

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
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-80 shrink-0 bg-slate-950 text-white xl:block">
          <div className="sticky top-0 h-screen overflow-y-auto px-5 py-6">
            <Link href="/admin/accreditation" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-slate-950">
                B
              </div>
              <div>
                <div className="font-bold">BAETE 3.0</div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                  Accreditation Workspace
                </div>
              </div>
            </Link>

            <nav className="mt-8 space-y-8 border-t border-slate-800 pt-6">
              {navGroups.map((group) => (
                <div key={group.title}>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {group.title}
                  </div>

                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active = isActive(pathname, item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                            active
                              ? "bg-blue-600 text-white"
                              : "text-slate-200 hover:bg-slate-900 hover:text-white"
                          }`}
                        >
                          <span className="w-5 text-center text-base">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs leading-6 text-slate-300">
              <div className="font-semibold text-white">
                Dynamic UniFlow Module
              </div>
              <p className="mt-2">
                Live work queues now show assigned tasks, committee work,
                pending evidence reviews, and overdue accreditation actions.
              </p>
              <Link
                href="/admin"
                className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-950"
              >
                Back to UniFlow Admin
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="px-5 py-5 lg:px-8">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                      EEE Program · Accreditation Workspace
                    </div>

                    {phaseLabel ? (
                      <div className="mt-6 text-xs font-bold uppercase tracking-[0.35em] text-amber-500">
                        {phaseLabel}
                      </div>
                    ) : null}

                    <h1 className="mt-2 font-serif text-4xl text-slate-950">
                      {title}
                    </h1>

                    {subtitle ? (
                      <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
                        {subtitle}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/admin/accreditation/my-tasks"
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      My Tasks
                    </Link>
                    <Link
                      href="/admin/accreditation/review-queue"
                      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      Review Queue
                    </Link>
                    <Link
                      href="/admin/accreditation/settings"
                      className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Settings
                    </Link>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 xl:hidden">
                  {navGroups.flatMap((group) => group.items).map((item) => {
                    const active = isActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-full px-3 py-2 text-xs font-semibold ${
                          active
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
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

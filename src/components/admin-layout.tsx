"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Footer from "@/components/Footer";

type AdminLayoutProps = {
  title?: string;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Main",
    items: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    title: "Accreditation",
    items: [
      { href: "/admin/accreditation", label: "BAETE Workspace" },
      { href: "/admin/accreditation/roadmap", label: "Readiness Roadmap" },
      { href: "/admin/accreditation/mock-audits", label: "Mock Audit Tool" },
      { href: "/admin/accreditation/analytics", label: "Historical Analytics" },
    ],
  },
  {
    title: "Core Setup",
    items: [
      { href: "/admin/academic-setup", label: "Academic Setup" },
      { href: "/admin/master-course-import", label: "Master Course Import" },
      {
        href: "/admin/imports",
        label: "Transcript & Registration Import",
      },
    ],
  },
  {
    title: "Student Core",
    items: [
      { href: "/admin/students", label: "Students" },
      { href: "/admin/students/bulk-import", label: "Student Bulk Import" },
      { href: "/admin/students/verification", label: "Student Verification" },
      { href: "/admin/student-auth-access", label: "Student Portal Access" },
    ],
  },
  {
    title: "Academic Structure",
    items: [
      { href: "/admin/batches", label: "Batch Setup" },
      { href: "/admin/batch-status", label: "Batch Status" },
      {
        href: "/admin/batch-offering-status",
        label: "Batch Offering Status",
      },
      {
        href: "/admin/batch-status-cleanup",
        label: "Batch Status Cleanup",
      },
      {
        href: "/admin/batch-curriculum-assignment",
        label: "Batch Curriculum",
      },
      { href: "/admin/courses", label: "Courses" },
    ],
  },
  {
    title: "Offering Preparation",
    items: [
      { href: "/admin/offering-context", label: "Offering Context" },
      {
        href: "/admin/offering-template-import",
        label: "Offering Template Import",
      },
      { href: "/admin/offerings", label: "Offering Workspace" },
      { href: "/admin/offering-drafts", label: "Offering Drafts" },
      { href: "/admin/co-offering-setup", label: "Co-offering Setup" },
      {
        href: "/admin/co-offering-decision-center",
        label: "Co-offering Decision Center",
      },
      { href: "/admin/manual-offering", label: "Manual Course Addition" },
      {
        href: "/admin/manual-special-offering",
        label: "Special Course Addition",
      },
      {
        href: "/admin/offering-validation",
        label: "Offering Validation",
      },
      {
        href: "/admin/offering-summary",
        label: "Offering Summary",
      },
    ],
  },
  {
    title: "Faculty Flow",
    items: [
      {
        href: "/admin/faculty-dashboard",
        label: "Faculty Operations Dashboard",
      },
      {
        href: "/admin/faculty-choice-control",
        label: "Faculty Choice Control",
      },
      {
        href: "/admin/faculty-course-choices",
        label: "Faculty Choice Approval",
      },
      { href: "/admin/faculty-assignment", label: "Faculty Assignment" },
      { href: "/admin/faculties", label: "Faculty Management" },
      { href: "/admin/users", label: "User Management" },
    ],
  },
  {
    title: "Scheduling & Finalization",
    items: [
      { href: "/admin/schedule", label: "Schedule Board" },
      {
        href: "/admin/schedule-control",
        label: "Final Schedule Control",
      },
      { href: "/admin/exam-scheduler", label: "Exam Scheduler" },
      { href: "/admin/faculty-load", label: "Faculty Load Board" },
      {
        href: "/admin/confirmed-schedule",
        label: "Confirmed Schedule",
      },
      { href: "/admin/batch-routine", label: "Batch Routine Report" },
      { href: "/admin/room-schedule", label: "Room Schedule Report" },
    ],
  },
  {
    title: "Reporting",
    items: [
      { href: "/admin/reports", label: "Reports Dashboard" },
      {
        href: "/admin/offering-reports",
        label: "Confirmed Offering Reports",
      },
    ],
  },
  {
    title: "Public View",
    items: [{ href: "/schedule", label: "Public Student Routine" }],
  },
  {
    title: "System",
    items: [
      { href: "/admin/rooms", label: "Room Management" },
      { href: "/admin/academic-terms", label: "Academic Terms" },
      {
        href: "/admin/semesters",
        label: "Academic Terms Management",
      },
      { href: "/admin/system-reset", label: "System Reset" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveGroup(pathname: string) {
  const match = navGroups.find((group) =>
    group.items.some((item) => isActive(pathname, item.href))
  );

  return match?.title ?? "Main";
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminLayout({
  title = "UniFlow Academic Planner",
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();

  const activeGroupTitle = useMemo(
    () => findActiveGroup(pathname),
    [pathname]
  );

  const [openGroup, setOpenGroup] = useState<string>(activeGroupTitle);

  useEffect(() => {
    setOpenGroup(activeGroupTitle);
  }, [activeGroupTitle]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/auth/login";
    }
  }

  function toggleGroup(groupTitle: string) {
    setOpenGroup((current) =>
      current === groupTitle ? "" : groupTitle
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-80 shrink-0 border-r border-slate-800 bg-slate-950 text-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="shrink-0 border-b border-slate-800/80 px-5 py-6">
              <Link href="/admin" className="block">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-950/30">
                    U
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-xl font-bold tracking-tight">
                      UniFlow
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Academic Planner
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-400">
                  Academic operations, offering, scheduling and reporting
                  workspace
                </p>
              </Link>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <nav className="space-y-2">
                {navGroups.map((group) => {
                  const groupOpen = openGroup === group.title;

                  const groupHasActiveItem = group.items.some((item) =>
                    isActive(pathname, item.href)
                  );

                  return (
                    <div
                      key={group.title}
                      className={`overflow-hidden rounded-xl border transition ${
                        groupHasActiveItem
                          ? "border-blue-500/40 bg-blue-500/5"
                          : "border-slate-800 bg-slate-900/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.title)}
                        aria-expanded={groupOpen}
                        className={`flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition ${
                          groupHasActiveItem
                            ? "text-white"
                            : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold uppercase tracking-[0.14em]">
                            {group.title}
                          </span>
                        </span>

                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              groupHasActiveItem
                                ? "bg-blue-500/20 text-blue-200"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {group.items.length}
                          </span>

                          <ChevronIcon open={groupOpen} />
                        </span>
                      </button>

                      <div
                        className={`grid transition-all duration-200 ease-out ${
                          groupOpen
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="space-y-1 border-t border-slate-800/80 px-2.5 py-2.5">
                            {group.items.map((item) => {
                              const active = isActive(
                                pathname,
                                item.href
                              );

                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                                    active
                                      ? "bg-blue-600 text-white shadow-sm"
                                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                                      active
                                        ? "bg-white"
                                        : "bg-slate-600 group-hover:bg-blue-400"
                                    }`}
                                  />

                                  <span className="min-w-0 truncate">
                                    {item.label}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>

            <div className="shrink-0 border-t border-slate-800 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-300">
                    Administrator
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    UniFlow Control Workspace
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                      UniFlow Academic Planner
                    </p>

                    <span className="text-slate-300">/</span>

                    <span className="text-xs font-semibold text-slate-500">
                      {activeGroupTitle}
                    </span>
                  </div>

                  <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900">
                    {title}
                  </h1>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/"
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Public Home
                  </Link>

                  <Link
                    href="/schedule"
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                  >
                    Public Routine
                  </Link>

                  <Link
                    href="/admin/accreditation"
                    className="rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
                  >
                    BAETE
                  </Link>

                  <Link
                    href="/admin/co-offering-decision-center"
                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                  >
                    Co-offering
                  </Link>

                  <Link
                    href="/admin/schedule-control"
                    className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    Final Schedule
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>

          <section className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </section>

          <Footer />
        </main>
      </div>
    </div>
  );
}

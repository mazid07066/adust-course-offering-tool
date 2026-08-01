"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
      { href: "/admin/imports", label: "Transcript & Registration Import" },
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
      { href: "/admin/batch-status-cleanup", label: "Batch Status Cleanup" },
      { href: "/admin/batch-curriculum-assignment", label: "Batch Curriculum" },
      { href: "/admin/courses", label: "Courses" },
    ],
  },
  {
    title: "Offering Preparation",
    items: [
      { href: "/admin/offering-context", label: "Offering Context" },
      { href: "/admin/offering-template-import", label: "Offering Template Import" },
      { href: "/admin/offerings", label: "Offering Workspace" },
      { href: "/admin/offering-drafts", label: "Offering Drafts" },
      { href: "/admin/co-offering-setup", label: "Co-offering Setup" },
      {
        href: "/admin/co-offering-decision-center",
        label: "Co-offering Decision Center",
      },
      { href: "/admin/manual-offering", label: "Manual Course Addition" },
    ],
  },
  {
    title: "Faculty Flow",
    items: [
      { href: "/admin/faculty-choice-control", label: "Faculty Choice Control" },
      { href: "/admin/faculty-course-choices", label: "Faculty Choice Approval" },
      { href: "/admin/faculty-assignment", label: "Faculty Assignment" },
      { href: "/admin/faculties", label: "Faculty Management" },
      { href: "/admin/users", label: "User Management" },
    ],
  },
  {
    title: "Scheduling & Finalization",
    items: [
      { href: "/admin/schedule", label: "Schedule Board" },
      { href: "/admin/schedule-control", label: "Final Schedule Control" },
      { href: "/admin/exam-scheduler", label: "Exam Scheduler" },
      { href: "/admin/faculty-load", label: "Faculty Load Board" },
      { href: "/admin/confirmed-schedule", label: "Confirmed Schedule" },
      { href: "/admin/batch-routine", label: "Batch Routine Report" },
      { href: "/admin/room-schedule", label: "Room Schedule Report" },
    ],
  },
  {
    title: "Reporting",
    items: [
      { href: "/admin/reports", label: "Reports Dashboard" },
      { href: "/admin/offering-reports", label: "Confirmed Offering Reports" },
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
      { href: "/admin/semesters", label: "Academic Terms Management" },
      { href: "/admin/system-reset", label: "System Reset" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({
  title = "UniFlow Academic Planner",
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/auth/login";
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-80 shrink-0 border-r border-slate-800 bg-slate-950 text-white lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto px-5 py-6">
            <Link href="/admin" className="block">
              <div className="text-2xl font-bold tracking-tight">
                UniFlow Academic Planner
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-300">
                Course offering, co-offering, scheduling, faculty assignment and
                reporting workspace
              </p>
            </Link>

            <nav className="mt-8 space-y-6">
              {navGroups.map((group) => (
                <div key={group.title}>
                  <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {group.title}
                  </div>

                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active = isActive(pathname, item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                            active
                              ? "bg-blue-600 text-white shadow"
                              : "text-slate-200 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                    UniFlow Academic Planner
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    {title}
                  </h1>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Public Home
                  </Link>

                  <Link
                    href="/schedule"
                    className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Public Routine
                  </Link>

                  <Link
                    href="/admin/accreditation"
                    className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
                  >
                    BAETE Workspace
                  </Link>

                  <Link
                    href="/admin/co-offering-decision-center"
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Co-offering Decision
                  </Link>

                  <Link
                    href="/admin/schedule-control"
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Final Schedule Control
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>

          <section className="px-4 py-6 sm:px-6 lg:px-8">{children}</section>

          <Footer />
        </main>
      </div>
    </div>
  );
}
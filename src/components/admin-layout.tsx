"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AdminLayoutProps = {
  title?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/academic-setup", label: "Academic Setup" },
  { href: "/admin/master-course-import", label: "Master Course Import" },
  { href: "/admin/imports", label: "Transcript & Registration Import" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/batch-curriculum-assignment", label: "Batch Curriculum Assignment" },
  { href: "/admin/faculties", label: "Faculties" },
  { href: "/admin/users", label: "User Accounts" },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/academic-terms", label: "Academic Terms" },
  { href: "/admin/semesters", label: "Academic Terms Management" },
  { href: "/admin/batches", label: "Batches" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/batch-status", label: "Batch Status" },
  { href: "/admin/batch-status-cleanup", label: "Batch Status Cleanup" },
  { href: "/admin/offering-context", label: "Offering Context" },
  { href: "/admin/offerings", label: "Offerings" },
  { href: "/admin/offering-drafts", label: "Draft Offerings" },
  { href: "/admin/co-offering-setup", label: "Co-offering Setup" },
  { href: "/admin/faculty-choice-control", label: "Faculty Choice Control" },
  { href: "/admin/faculty-course-choices", label: "Faculty Course Choices" },
  { href: "/admin/faculty-assignment", label: "Faculty Assignment" },
  { href: "/admin/offering-reports", label: "Confirmed Offering Reports" },
  { href: "/admin/faculty-load", label: "Faculty Load Report" },
  { href: "/admin/confirmed-schedule", label: "Confirmed Schedule" },
  { href: "/admin/batch-routine", label: "Batch Routine Report" },
  { href: "/admin/room-schedule", label: "Room Schedule Report" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/system-reset", label: "System Reset" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({
  title = "Admin Panel",
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
        <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950 text-white lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto px-5 py-6">
            <Link href="/admin" className="block">
              <div className="text-2xl font-bold tracking-tight">
                ADUST Course Tool
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-300">
                Professional academic offering and scheduling workspace
              </p>
            </Link>

            <nav className="mt-8 space-y-1">
              {navItems.map((item) => {
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
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                    ADUST Course Offering Tool
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
                    href="/admin/academic-setup"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Open Academic Setup
                  </Link>

                  <button
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
        </main>
      </div>
    </div>
  );
}
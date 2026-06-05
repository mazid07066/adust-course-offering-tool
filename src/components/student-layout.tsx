"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type StudentLayoutProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/student/dashboard", label: "Dashboard" },
  { href: "/student/profile", label: "My Profile" },
  { href: "/student/change-password", label: "Change Password" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function StudentLayout({
  title = "Student Portal",
  subtitle = "Academic profile and account workspace",
  children,
}: StudentLayoutProps) {
  const pathname = usePathname();

  async function handleLogout() {
    try {
      await fetch("/api/student-auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/student/login";
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950 text-white lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto px-5 py-6">
            <Link href="/student/dashboard" className="block">
              <div className="text-2xl font-bold tracking-tight">
                UniFlow Student
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-300">
                ADUST student portal workspace
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

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
              Registration, billing, attendance, grades, admit card, and result
              features are intentionally locked for later ERP checkpoints.
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                    ADUST UniFlow Student Portal
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
                    >
                      {item.label}
                    </Link>
                  ))}

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
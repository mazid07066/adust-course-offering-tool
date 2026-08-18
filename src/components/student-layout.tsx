"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import UniFlowLogo from "@/components/uniflow-logo";

type StudentLayoutProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

const navItems = [
  {
    href: "/student/dashboard",
    label: "Dashboard",
  },
  {
    href: "/student/profile",
    label: "My Profile",
  },
  {
    href: "/student/change-password",
    label: "Change Password",
  },
];

function isActive(
  pathname: string,
  href: string
) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export default function StudentLayout({
  title = "Student Portal",
  subtitle = "Academic profile and account workspace",
  children,
}: StudentLayoutProps) {
  const pathname =
    usePathname();

  async function handleLogout() {
    try {
      await fetch(
        "/api/student-auth/logout",
        {
          method: "POST",
        }
      );
    } finally {
      window.location.href =
        "/student/login";
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f8fc] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-72 shrink-0 border-r border-cyan-950/50 bg-[#071b3c] text-white lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto px-5 py-6">
            <UniFlowLogo
              href="/student/dashboard"
              compact
              darkSurface
            />

            <p className="mt-4 text-xs leading-5 text-cyan-50/60">
              Student academic identity,
              profile, registration, and
              academic service workspace.
            </p>

            <nav className="mt-8 space-y-1">
              {navItems.map(
                (item) => {
                  const active =
                    isActive(
                      pathname,
                      item.href
                    );

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        active
                          ? "bg-[#0867b2] text-white shadow-lg shadow-black/10"
                          : "text-cyan-50/75 hover:bg-[#0b2f5f] hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                }
              )}
            </nav>

            <div className="mt-8 rounded-2xl border border-cyan-900/60 bg-[#0b2f5f]/70 p-4 text-sm leading-6 text-cyan-50/70">
              Additional student ERP
              services will become
              available as the relevant
              academic modules are
              activated.
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-[#d9e5f0] bg-white/95 backdrop-blur">
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#079db8]">
                    UniFlow Student Portal
                  </p>

                  <h1 className="mt-1 text-2xl font-black tracking-tight text-[#071b3c]">
                    {title}
                  </h1>

                  {subtitle && (
                    <p className="mt-1 text-sm text-slate-500">
                      {subtitle}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {navItems.map(
                    (item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-xl border border-[#d9e5f0] bg-white px-4 py-2 text-sm font-semibold text-[#071b3c] transition hover:border-[#079db8]/40 hover:bg-[#eafafb] lg:hidden"
                      >
                        {item.label}
                      </Link>
                    )
                  )}

                  <button
                    onClick={
                      handleLogout
                    }
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>

            <div className="h-1 w-full bg-gradient-to-r from-[#0867b2] via-[#079db8] to-[#4dc21f]" />
          </header>

          <section className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}

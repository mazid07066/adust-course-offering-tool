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

type NavigationContentProps = {
  pathname: string;
  activeHref: string;
  openGroup: string;
  onToggleGroup: (groupTitle: string) => void;
  onNavigate?: () => void;
  onLogout: () => Promise<void>;
  mobile?: boolean;
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

function routeMatches(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  if (href === "/schedule") {
    return pathname === "/schedule";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveHref(pathname: string) {
  const matchingItems = navGroups
    .flatMap((group) => group.items)
    .filter((item) => routeMatches(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length);

  return matchingItems[0]?.href ?? "";
}

function findActiveGroup(activeHref: string) {
  if (!activeHref) {
    return "Main";
  }

  const match = navGroups.find((group) =>
    group.items.some((item) => item.href === activeHref)
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

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
    >
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavigationContent({
  activeHref,
  openGroup,
  onToggleGroup,
  onNavigate,
  onLogout,
  mobile = false,
}: NavigationContentProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-800/80 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            href="/admin"
            onClick={onNavigate}
            className="min-w-0 flex-1"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-950/30">
                U
              </div>

              <div className="min-w-0">
                <div className="truncate text-xl font-bold tracking-tight text-white">
                  UniFlow
                </div>
                <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Academic Planner
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-400">
              Academic operations, offering, scheduling and reporting workspace
            </p>
          </Link>

          {mobile ? (
            <button
              type="button"
              onClick={onNavigate}
              aria-label="Close navigation"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <nav className="space-y-2">
          {navGroups.map((group) => {
            const groupOpen = openGroup === group.title;

            const groupHasActiveItem = group.items.some(
              (item) => item.href === activeHref
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
                  onClick={() => onToggleGroup(group.title)}
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
                        const active = item.href === activeHref;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
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
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-300">
              Administrator
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              UniFlow Control Workspace
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  title = "UniFlow Academic Planner",
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();

  const activeHref = useMemo(
    () => findActiveHref(pathname),
    [pathname]
  );

  const activeGroupTitle = useMemo(
    () => findActiveGroup(activeHref),
    [activeHref]
  );

  const [openGroup, setOpenGroup] = useState<string>(activeGroupTitle);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setOpenGroup(activeGroupTitle);
  }, [activeGroupTitle]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

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
          <div className="sticky top-0 h-screen">
            <NavigationContent
              pathname={pathname}
              activeHref={activeHref}
              openGroup={openGroup}
              onToggleGroup={toggleGroup}
              onLogout={handleLogout}
            />
          </div>
        </aside>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation backdrop"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            />

            <aside className="absolute inset-y-0 left-0 w-[min(88vw,340px)] border-r border-slate-800 bg-slate-950 text-white shadow-2xl">
              <NavigationContent
                pathname={pathname}
                activeHref={activeHref}
                openGroup={openGroup}
                onToggleGroup={toggleGroup}
                onNavigate={() => setMobileMenuOpen(false)}
                onLogout={handleLogout}
                mobile
              />
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    aria-label="Open admin navigation"
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 lg:hidden"
                  >
                    <MenuIcon />
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                        UniFlow Academic Planner
                      </p>

                      <span className="hidden text-slate-300 sm:inline">
                        /
                      </span>

                      <span className="hidden text-xs font-semibold text-slate-500 sm:inline">
                        {activeGroupTitle}
                      </span>
                    </div>

                    <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                      {title}
                    </h1>

                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 sm:hidden">
                      <span>{activeGroupTitle}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <HomeIcon />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>

                  <Link
                    href="/"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Public Home
                  </Link>

                  <Link
                    href="/schedule"
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                  >
                    Public Routine
                  </Link>

                  <Link
                    href="/admin/accreditation"
                    className="hidden rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100 2xl:inline-flex"
                  >
                    BAETE
                  </Link>

                  <Link
                    href="/admin/co-offering-decision-center"
                    className="hidden rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 2xl:inline-flex"
                  >
                    Co-offering
                  </Link>

                  <Link
                    href="/admin/schedule-control"
                    className="hidden rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 xl:inline-flex"
                  >
                    Final Schedule
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
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

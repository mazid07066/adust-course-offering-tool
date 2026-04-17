import Link from "next/link";
import { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

const navItems: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/admin/master-course-import", label: "Master Course Import" },
  { href: "/admin/imports", label: "Transcript & Registration Import" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/batch-curriculum-assignment", label: "Batch Curriculum Assignment" },
  { href: "/admin/faculties", label: "Faculties" },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/semesters", label: "Academic Terms" },
  { href: "/admin/academic-terms", label: "Academic Terms Management" },
  { href: "/admin/batches", label: "Batches" },
  { href: "/admin/batch-status", label: "Batch Status" },
  { href: "/admin/batch-status-cleanup", label: "Batch Status Cleanup" },
  { href: "/admin/offering-context", label: "Offering Context" },
  { href: "/admin/offerings", label: "Offerings" },
  { href: "/admin/offering-drafts", label: "Draft Offerings" },
  { href: "/admin/offering-reports", label: "Confirmed Offering Reports" },
  { href: "/admin/faculty-load", label: "Faculty Load Report" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/faculty-dashboard", label: "Faculty Dashboard" },
];

export default function AdminLayout({ title, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen md:grid-cols-[270px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950 text-slate-100">
          <div className="sticky top-0 p-6">
            <div className="mb-8">
              <h1 className="text-xl font-semibold tracking-tight">
                ADUST Course Tool
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Academic course offering management
              </p>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 bg-slate-100">
          <div className="border-b border-slate-200 bg-white px-8 py-6 shadow-sm">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage courses, batches, imports, offerings, and reports.
            </p>
          </div>

          <div className="p-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
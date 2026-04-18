import Link from "next/link";
import AdminLayout from "@/components/admin-layout";

const quickStats = [
  {
    title: "Core Setup",
    value: "Academic Setup",
    note: "Programs, shifts, curriculum versions, and student ID suffix mapping",
  },
  {
    title: "Curriculum Input",
    value: "Excel / DOCX",
    note: "Master course import for exact academic identities",
  },
  {
    title: "Student Status",
    value: "Transcript + Registration",
    note: "Completed, ongoing, and remaining course computation",
  },
  {
    title: "Offering Engine",
    value: "Conflict Aware",
    note: "Faculty, room, section, and time conflict control",
  },
];

const modules = [
  {
    title: "Academic Setup",
    description:
      "Create the exact program identities that the whole system will use as the dropdown source.",
    href: "/admin/academic-setup",
  },
  {
    title: "Master Course Import",
    description:
      "Upload curriculum files for each exact academic identity using Excel or DOCX.",
    href: "/admin/master-course-import",
  },
  {
    title: "Transcript & Registration Import",
    description:
      "Import student transcript and registration PDFs to derive completed, ongoing, and remaining courses.",
    href: "/admin/imports",
  },
  {
    title: "Batch Status",
    description:
      "Review batch-wise course completion state with completed, ongoing, and remaining categories.",
    href: "/admin/batch-status",
  },
  {
    title: "Offerings",
    description:
      "Prepare next-semester offerings with faculty, room, section, and timing controls.",
    href: "/admin/offerings",
  },
  {
    title: "Confirmed Offering Reports",
    description:
      "View reports, schedules, and faculty load summaries from confirmed offerings.",
    href: "/admin/offering-reports",
  },
  {
    title: "System Reset",
    description:
      "Clear previous test data for a fresh controlled setup before final testing.",
    href: "/admin/system-reset",
  },
];

export default function AdminDashboardPage() {
  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-8">
        <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 p-8 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
            Central Academic Operations
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            ADUST Course Offering Management Workspace
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
            Configure academic identities, import structured curricula, parse transcript and
            registration data, build semester offerings, and generate operational reports from one
            controlled administrative environment.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/academic-setup"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Start Academic Setup
            </Link>
            <Link
              href="/admin/system-reset"
              className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Open System Reset
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.title}
              </p>
              <h3 className="mt-3 text-2xl font-bold text-slate-900">{item.value}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="text-xl font-bold text-slate-900">Operational Modules</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use the modules below in sequence for fresh system setup, academic data import,
              offering generation, and reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <div
                key={module.href}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-blue-300 hover:bg-white hover:shadow-sm"
              >
                <h4 className="text-lg font-semibold text-slate-900">{module.title}</h4>
                <p className="mt-3 text-sm leading-6 text-slate-600">{module.description}</p>
                <Link
                  href={module.href}
                  className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Open module
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
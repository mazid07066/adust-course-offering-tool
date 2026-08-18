import Link from "next/link";
import AdminLayout from "@/components/admin-layout";

const capabilityCards = [
  {
    eyebrow: "Academic Administration",
    title: "Academic Structure",
    description:
      "Manage programs, study shifts, curriculum versions, academic terms, batches, and related institutional records.",
    href: "/admin/academic-setup",
    accent: "blue",
  },
  {
    eyebrow: "Curriculum & Student Records",
    title: "Academic Data Management",
    description:
      "Maintain curriculum data and process student academic records required for course eligibility and progression analysis.",
    href: "/admin/master-course-import",
    accent: "indigo",
  },
  {
    eyebrow: "Semester Administration",
    title: "Course Offering Management",
    description:
      "Prepare semester course offerings, manage co-offering relationships, and coordinate faculty assignment requirements.",
    href: "/admin/offering-drafts",
    accent: "violet",
  },
  {
    eyebrow: "Scheduling & Reporting",
    title: "Schedule Administration",
    description:
      "Manage class schedules, review operational conflicts, finalize scheduling decisions, and access institutional reports.",
    href: "/admin/schedule-control",
    accent: "emerald",
  },
];

const workflowModules = [
  {
    step: "01",
    title: "Academic Setup",
    description:
      "Configure programs, study shifts, curriculum versions, academic identities, and related institutional parameters.",
    href: "/admin/academic-setup",
    group: "Administration",
  },
  {
    step: "02",
    title: "Master Course Management",
    description:
      "Import and maintain authoritative curriculum and course information for configured academic programs.",
    href: "/admin/master-course-import",
    group: "Curriculum",
  },
  {
    step: "03",
    title: "Student Academic Records",
    description:
      "Process transcript and registration information used for academic status and course progression analysis.",
    href: "/admin/imports",
    group: "Student Records",
  },
  {
    step: "04",
    title: "Batch Academic Status",
    description:
      "Review batch-level academic progression, including completed, ongoing, and remaining course requirements.",
    href: "/admin/batch-status",
    group: "Academic Status",
  },
  {
    step: "05",
    title: "Course Offering Preparation",
    description:
      "Prepare and review semester course offerings before faculty assignment and schedule finalization.",
    href: "/admin/offering-drafts",
    group: "Course Offering",
  },
  {
    step: "06",
    title: "Co-offering Management",
    description:
      "Review and administer primary and secondary course relationships across participating academic programs.",
    href: "/admin/co-offering-decision-center",
    group: "Course Offering",
  },
  {
    step: "07",
    title: "Faculty Assignment",
    description:
      "Administer faculty course preferences, approval decisions, teaching assignments, and associated academic workload.",
    href: "/admin/faculty-choice-control",
    group: "Faculty",
  },
  {
    step: "08",
    title: "Schedule Finalization",
    description:
      "Review class schedules, faculty allocation, room assignments, and scheduling conflicts prior to final confirmation.",
    href: "/admin/schedule-control",
    group: "Scheduling",
  },
  {
    step: "09",
    title: "Academic Reports",
    description:
      "Access institutional reports covering course offerings, schedules, faculty workload, rooms, batches, and related outputs.",
    href: "/admin/reports",
    group: "Reporting",
  },
];

const directActions = [
  {
    label: "Course Offerings",
    href: "/admin/offering-drafts",
  },
  {
    label: "Faculty Assignment",
    href: "/admin/faculty-choice-control",
  },
  {
    label: "Exam Scheduling",
    href: "/admin/exam-scheduler",
  },
  {
    label: "Academic Reports",
    href: "/admin/reports",
  },
];

function capabilityStyles(accent: string) {
  switch (accent) {
    case "indigo":
      return {
        shell: "border-indigo-100 bg-indigo-50/70",
        eyebrow: "text-indigo-700",
        dot: "bg-indigo-500",
        link: "text-indigo-700 hover:text-indigo-900",
      };

    case "violet":
      return {
        shell: "border-violet-100 bg-violet-50/70",
        eyebrow: "text-violet-700",
        dot: "bg-violet-500",
        link: "text-violet-700 hover:text-violet-900",
      };

    case "emerald":
      return {
        shell: "border-emerald-100 bg-emerald-50/70",
        eyebrow: "text-emerald-700",
        dot: "bg-emerald-500",
        link: "text-emerald-700 hover:text-emerald-900",
      };

    default:
      return {
        shell: "border-blue-100 bg-blue-50/70",
        eyebrow: "text-blue-700",
        dot: "bg-blue-500",
        link: "text-blue-700 hover:text-blue-900",
      };
  }
}

export default function AdminDashboardPage() {
  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-sky-50 via-white to-indigo-100/80 shadow-sm">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-blue-200/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
          <div className="pointer-events-none absolute left-1/3 top-10 h-44 w-44 rounded-full bg-cyan-100/50 blur-3xl" />

          <div className="relative grid gap-8 p-7 sm:p-9 xl:grid-cols-[1.35fr_0.65fr] xl:p-10">
            <div className="flex flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-blue-700 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Academic Administration
              </div>

              <h2 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                UniFlow Academic Operations
              </h2>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                Centralized administration of academic structure, student
                records, semester course offerings, faculty assignment,
                scheduling, and institutional reporting within a coordinated
                academic management environment.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/admin/offering-drafts"
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  Manage Course Offerings
                </Link>

                <Link
                  href="/admin/schedule-control"
                  className="rounded-xl border border-blue-200 bg-white/80 px-5 py-2.5 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-white"
                >
                  Schedule Control
                </Link>

                <Link
                  href="/admin/reports"
                  className="rounded-xl border border-slate-200 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
                >
                  Academic Reports
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white/65 p-5 shadow-sm backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Semester Administration
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-white/80 p-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xs font-black text-blue-700">
                    1
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Academic Preparation
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Academic structure, curriculum, student records, and
                      batch status
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white/80 p-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xs font-black text-indigo-700">
                    2
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Offering & Faculty Administration
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Course offerings, co-offering, faculty preferences, and
                      teaching assignments
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white/80 p-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-700">
                    3
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Scheduling & Finalization
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Schedule validation, room allocation, finalization, and
                      institutional reporting
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-200/70 pt-4">
                <p className="text-xs font-semibold text-slate-500">
                  Administrative Shortcuts
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {directActions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                Administrative Areas
              </p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                Core Academic Management Functions
              </h3>
            </div>

            <p className="max-w-xl text-sm leading-6 text-slate-500">
              Access the principal administrative areas supporting academic
              preparation, semester operations, scheduling, and reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilityCards.map((item) => {
              const styles = capabilityStyles(item.accent);

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md ${styles.shell}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${styles.dot}`} />

                    <p
                      className={`text-[11px] font-bold uppercase tracking-[0.16em] ${styles.eyebrow}`}
                    >
                      {item.eyebrow}
                    </p>
                  </div>

                  <h4 className="mt-4 text-xl font-bold tracking-tight text-slate-950">
                    {item.title}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>

                  <div
                    className={`mt-5 text-sm font-semibold transition ${styles.link}`}
                  >
                    Access Module
                    <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5 sm:px-7">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Semester Operations
                </p>

                <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  Academic Administration Workflow
                </h3>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-slate-500">
                Primary administrative functions are organized according to
                the academic preparation, offering, assignment, scheduling,
                and reporting lifecycle.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
            {workflowModules.map((module, index) => (
              <Link
                key={module.href}
                href={module.href}
                className={`group relative p-6 transition hover:bg-blue-50/50 ${
                  index >= 3 ? "md:border-t md:border-slate-100" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600 transition group-hover:bg-blue-600 group-hover:text-white">
                    {module.step}
                  </div>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    {module.group}
                  </span>
                </div>

                <h4 className="mt-5 text-lg font-bold text-slate-950 transition group-hover:text-blue-800">
                  {module.title}
                </h4>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {module.description}
                </p>

                <div className="mt-5 flex items-center text-sm font-semibold text-blue-700">
                  Access Module
                  <span className="ml-1 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
              Specialized Administration
            </p>

            <h3 className="mt-2 text-xl font-bold text-slate-950">
              Institutional Management Functions
            </h3>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/admin/accreditation"
                className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 transition hover:border-violet-200 hover:bg-violet-50"
              >
                <p className="font-semibold text-violet-950">
                  BAETE Accreditation Management
                </p>
                <p className="mt-1 text-sm leading-5 text-violet-700/80">
                  Accreditation readiness, tasks, evidence, review, and
                  institutional monitoring.
                </p>
              </Link>

              <Link
                href="/admin/exam-scheduler"
                className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 transition hover:border-amber-200 hover:bg-amber-50"
              >
                <p className="font-semibold text-amber-950">
                  Examination Scheduling
                </p>
                <p className="mt-1 text-sm leading-5 text-amber-700/80">
                  Prepare, review, and administer academic examination
                  schedules.
                </p>
              </Link>

              <Link
                href="/admin/faculty-dashboard"
                className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 transition hover:border-sky-200 hover:bg-sky-50"
              >
                <p className="font-semibold text-sky-950">
                  Faculty Administration
                </p>
                <p className="mt-1 text-sm leading-5 text-sky-700/80">
                  Review teaching assignments, faculty workload, and routine
                  information.
                </p>
              </Link>

              <Link
                href="/admin/students"
                className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                <p className="font-semibold text-emerald-950">
                  Student Administration
                </p>
                <p className="mt-1 text-sm leading-5 text-emerald-700/80">
                  Manage student records, academic status, enrollment, and
                  verification functions.
                </p>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-sm sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
              Integrated Academic Management
            </p>

            <h3 className="mt-3 text-2xl font-bold tracking-tight">
              Coordinated Academic Administration
            </h3>

            <p className="mt-3 text-sm leading-7 text-blue-50/90">
              UniFlow maintains a consistent academic data foundation across
              course offering, faculty assignment, scheduling, and reporting
              while preserving the established rules and responsibilities of
              each administrative function.
            </p>

            <Link
              href="/admin/reports"
              className="mt-6 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
            >
              Access Academic Reports
            </Link>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

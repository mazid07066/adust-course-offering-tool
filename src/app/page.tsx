import Link from "next/link";

const cards = [
  {
    title: "Master Course Import",
    description:
      "Upload Word or Excel master course lists for each department and program.",
    href: "/admin/master-course-import",
  },
  {
    title: "Transcript & Registration Import",
    description:
      "Parse transcript and registration PDF files to identify batch, completed courses, and current semester courses.",
    href: "/admin/imports",
  },
  {
    title: "Courses",
    description:
      "Review master course lists stored in the database across all departments and programs.",
    href: "/admin/courses",
  },
  {
    title: "Batches",
    description:
      "Check available batches and confirm the batch structure for offering operations.",
    href: "/admin/batches",
  },
  {
    title: "Offerings",
    description:
      "Prepare offerings using user-provided semester text such as spring, summer, or fall with year.",
    href: "/admin/offerings",
  },
  {
    title: "Faculty Dashboard",
    description:
      "Review teacher-related information and later connect faculty-specific routine access.",
    href: "/admin/faculty-dashboard",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-8 py-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            ADUST Course Offering Tool
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            A centralized academic management workspace for master course import,
            transcript and registration parsing, course offering preparation,
            routine generation, and faculty load reporting.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-8 py-10">
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Departments</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">Multi</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Master Course Input</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">Word / Excel</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Offering Term Input</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">Text Based</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
              <div className="mt-5 text-sm font-medium text-blue-700">
                Open module →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
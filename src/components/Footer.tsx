export default function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-600">
      <div className="mx-auto max-w-5xl space-y-2 px-4">
        <p className="font-semibold text-slate-900">
          UniFlow Academic Planner
        </p>

        <p>
          Built with Next.js, React, TypeScript, Prisma ORM, PostgreSQL, and
          Tailwind CSS.
        </p>

        <p>
          A complete academic workflow system for curriculum planning, course
          offering, scheduling, co-offering management, faculty choice, and
          faculty load allocation.
        </p>

        <p className="pt-2 text-xs text-slate-500">
          Designed and Developed by Mazid Ishtique Ahmed, Assistant Professor,
          EEE and Chairman, Dept. of Robotics and Automation Engineering, Atish
          Dipankar University of Science & Technology (ADUST)
        </p>
      </div>
    </footer>
  );
}
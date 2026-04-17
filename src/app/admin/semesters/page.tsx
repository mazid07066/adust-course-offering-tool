import AdminLayout from "@/components/admin-layout";
import { prisma } from "@/lib/prisma";

export default async function SemestersPage() {
  const semesters = await prisma.academic_terms.findMany({
    orderBy: [{ year: "desc" }, { term_type: "asc" }],
  });

  return (
    <AdminLayout title="Academic Terms">
      <div className="overflow-x-auto">
        <table className="min-w-full border border-slate-200 text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border px-3 py-2 text-left">Name</th>
              <th className="border px-3 py-2 text-left">Year</th>
              <th className="border px-3 py-2 text-left">Term Type</th>
              <th className="border px-3 py-2 text-left">Active</th>
            </tr>
          </thead>
          <tbody>
            {semesters.map((semester) => (
              <tr key={semester.id} className="hover:bg-slate-50">
                <td className="border px-3 py-2 font-medium">{semester.name}</td>
                <td className="border px-3 py-2">{semester.year}</td>
                <td className="border px-3 py-2">{semester.term_type}</td>
                <td className="border px-3 py-2">
                  {semester.is_active ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
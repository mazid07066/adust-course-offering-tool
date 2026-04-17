import AdminLayout from "@/components/admin-layout";
import { prisma } from "@/lib/prisma";

export default async function BatchesPage() {
  const batches = await prisma.batches.findMany({
    include: {
      programs: true,
    },
    orderBy: {
      batch_code: "asc",
    },
  });

  return (
    <AdminLayout title="Batches">
      <div className="overflow-x-auto">
        <table className="min-w-full border border-slate-200 text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border px-3 py-2 text-left">Batch Code</th>
              <th className="border px-3 py-2 text-left">Program</th>
              <th className="border px-3 py-2 text-left">Admission Term</th>
              <th className="border px-3 py-2 text-left">Active</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} className="hover:bg-slate-50">
                <td className="border px-3 py-2 font-medium">{batch.batch_code}</td>
                <td className="border px-3 py-2">{batch.programs.name}</td>
                <td className="border px-3 py-2">{batch.admission_term ?? "-"}</td>
                <td className="border px-3 py-2">
                  {batch.is_active ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
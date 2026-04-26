import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import AdminLayout from "@/components/admin-layout";
import ReportsPageClient from "./page-client";

export default async function ReportsPage() {
  await requireCoordinatorOrAdmin();

  return (
    <AdminLayout title="Professional Reports Dashboard">
      <ReportsPageClient />
    </AdminLayout>
  );
}
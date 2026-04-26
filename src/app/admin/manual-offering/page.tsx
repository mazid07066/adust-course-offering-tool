import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import AdminLayout from "@/components/admin-layout";
import ManualOfferingPageClient from "./page-client";

export default async function ManualOfferingPage() {
  await requireCoordinatorOrAdmin();

  return (
    <AdminLayout title="Manual Course Addition">
      <ManualOfferingPageClient />
    </AdminLayout>
  );
}
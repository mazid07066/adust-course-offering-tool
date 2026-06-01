import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import StudentBulkImportPageClient from "./page-client";

export default async function StudentBulkImportPage() {
  await requireCoordinatorOrAdmin();
  return <StudentBulkImportPageClient />;
}
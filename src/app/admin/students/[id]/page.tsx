import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import StudentDetailPageClient from "./page-client";

export default async function StudentDetailPage() {
  await requireCoordinatorOrAdmin();
  return <StudentDetailPageClient />;
}
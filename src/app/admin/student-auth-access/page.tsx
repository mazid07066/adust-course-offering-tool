import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import StudentAuthAccessPageClient from "./page-client";

export default async function StudentAuthAccessPage() {
  await requireCoordinatorOrAdmin();

  return <StudentAuthAccessPageClient />;
}
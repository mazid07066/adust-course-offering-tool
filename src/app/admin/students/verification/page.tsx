import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import StudentVerificationPageClient from "./page-client";

export default async function StudentVerificationPage() {
  await requireCoordinatorOrAdmin();
  return <StudentVerificationPageClient />;
}
import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import FacultyAssignmentPageClient from "./page-client";

export default async function FacultyAssignmentPage() {
  await requireCoordinatorOrAdmin();
  return <FacultyAssignmentPageClient />;
}
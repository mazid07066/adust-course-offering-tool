import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BatchCurriculumAssignmentPageClient from "./page-client";

export default async function BatchCurriculumAssignmentPage() {
  await requireCoordinatorOrAdmin();
  return <BatchCurriculumAssignmentPageClient />;
}
import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import ExamSchedulerPageClient from "./page-client";

export default async function ExamSchedulerPage() {
  await requireCoordinatorOrAdmin();

  return <ExamSchedulerPageClient />;
}
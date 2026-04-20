import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BatchRoutinePageClient from "./page-client";

export default async function BatchRoutinePage() {
  await requireCoordinatorOrAdmin();
  return <BatchRoutinePageClient />;
}
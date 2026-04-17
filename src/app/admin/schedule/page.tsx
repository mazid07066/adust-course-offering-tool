import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import SchedulePageClient from "./page-client";

export default async function SchedulePage() {
  await requireCoordinatorOrAdmin();
  return <SchedulePageClient />;
}
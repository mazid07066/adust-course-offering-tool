import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import ConfirmedSchedulePageClient from "./page-client";

export default async function ConfirmedSchedulePage() {
  await requireCoordinatorOrAdmin();
  return <ConfirmedSchedulePageClient />;
}
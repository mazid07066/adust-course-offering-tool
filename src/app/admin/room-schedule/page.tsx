import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import RoomSchedulePageClient from "./page-client";

export default async function RoomSchedulePage() {
  await requireCoordinatorOrAdmin();
  return <RoomSchedulePageClient />;
}
import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import RoomsPageClient from "./page-client";

export default async function RoomsPage() {
  await requireCoordinatorOrAdmin();
  return <RoomsPageClient />;
}
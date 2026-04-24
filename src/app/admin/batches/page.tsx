import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BatchesPageClient from "./page-client";

export default async function BatchesPage() {
  await requireCoordinatorOrAdmin();
  return <BatchesPageClient />;
}
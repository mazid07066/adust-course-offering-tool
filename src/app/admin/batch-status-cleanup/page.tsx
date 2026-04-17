import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BatchStatusCleanupPageClient from "./page-client";

export default async function BatchStatusCleanupPage() {
  await requireCoordinatorOrAdmin();
  return <BatchStatusCleanupPageClient />;
}
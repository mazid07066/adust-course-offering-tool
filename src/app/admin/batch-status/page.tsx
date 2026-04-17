import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BatchStatusPageClient from "./page-client";

export default async function BatchStatusPage() {
  await requireCoordinatorOrAdmin();
  return <BatchStatusPageClient />;
}
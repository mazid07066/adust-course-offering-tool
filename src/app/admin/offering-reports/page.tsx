import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import OfferingReportsPageClient from "./page-client";

export default async function OfferingReportsPage() {
  await requireCoordinatorOrAdmin();
  return <OfferingReportsPageClient />;
}
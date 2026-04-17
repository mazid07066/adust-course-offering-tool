import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import OfferingDraftsPageClient from "./page-client";

export default async function OfferingDraftsPage() {
  await requireCoordinatorOrAdmin();
  return <OfferingDraftsPageClient />;
}
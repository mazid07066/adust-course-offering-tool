import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import OfferingSummaryPageClient from "./page-client";

export default async function OfferingSummaryPage() {
  await requireCoordinatorOrAdmin();
  return <OfferingSummaryPageClient />;
}
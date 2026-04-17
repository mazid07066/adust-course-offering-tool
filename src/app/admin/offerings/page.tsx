import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import OfferingsPageClient from "./page-client";

export default async function OfferingsPage() {
  await requireCoordinatorOrAdmin();
  return <OfferingsPageClient />;
}
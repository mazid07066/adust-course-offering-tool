import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import OfferingValidationPageClient from "./page-client";

export default async function OfferingValidationPage() {
  await requireCoordinatorOrAdmin();
  return <OfferingValidationPageClient />;
}
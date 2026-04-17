import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import OfferingContextPageClient from "./page-client";

export default async function OfferingContextPage() {
  await requireCoordinatorOrAdmin();
  return <OfferingContextPageClient />;
}
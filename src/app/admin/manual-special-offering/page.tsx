import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import ManualSpecialOfferingPageClient from "./page-client";

export default async function ManualSpecialOfferingPage() {
  await requireCoordinatorOrAdmin();
  return <ManualSpecialOfferingPageClient />;
}
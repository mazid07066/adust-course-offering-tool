import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import OfferingTemplateImportPageClient from "./page-client";

export default async function OfferingTemplateImportPage() {
  await requireCoordinatorOrAdmin();
  return <OfferingTemplateImportPageClient />;
}
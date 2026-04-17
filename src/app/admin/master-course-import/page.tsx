import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import MasterCourseImportPageClient from "./page-client";

export default async function MasterCourseImportPage() {
  await requireCoordinatorOrAdmin();
  return <MasterCourseImportPageClient />;
}
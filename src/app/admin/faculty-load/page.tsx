import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import FacultyLoadPageClient from "./page-client";

export default async function FacultyLoadPage() {
  await requireCoordinatorOrAdmin();
  return <FacultyLoadPageClient />;
}
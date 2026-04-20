import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import FacultyCourseChoicesAdminPageClient from "./page-client";

export default async function FacultyCourseChoicesAdminPage() {
  await requireCoordinatorOrAdmin();
  return <FacultyCourseChoicesAdminPageClient />;
}
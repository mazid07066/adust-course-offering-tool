import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import StudentProfilePageClient from "./page-client";

export default async function StudentProfilePage() {
  await requireCoordinatorOrAdmin();
  return <StudentProfilePageClient />;
}
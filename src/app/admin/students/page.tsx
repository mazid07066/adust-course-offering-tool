import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import StudentsPageClient from "./page-client";

export default async function StudentsPage() {
  await requireCoordinatorOrAdmin();
  return <StudentsPageClient />;
}
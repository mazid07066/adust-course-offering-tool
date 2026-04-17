import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import CoursesPageClient from "./page-client";

export default async function CoursesPage() {
  await requireCoordinatorOrAdmin();
  return <CoursesPageClient />;
}
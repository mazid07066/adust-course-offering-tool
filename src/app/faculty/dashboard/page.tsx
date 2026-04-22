import { requireFaculty } from "@/lib/auth-guard";
import FacultyDashboardPageClient from "./page-client";

export default async function FacultyDashboardPage() {
  await requireFaculty();
  return <FacultyDashboardPageClient />;
}
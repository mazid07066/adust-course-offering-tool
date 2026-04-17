import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import FacultiesPageClient from "./page-client";

export default async function FacultiesPage() {
  await requireCoordinatorOrAdmin();
  return <FacultiesPageClient />;
}
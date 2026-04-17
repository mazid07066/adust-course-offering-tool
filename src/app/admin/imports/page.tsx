import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import ImportsPageClient from "./page-client";

export default async function ImportsPage() {
  await requireCoordinatorOrAdmin();
  return <ImportsPageClient />;
}
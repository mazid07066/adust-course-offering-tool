import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import AcademicTermsClient from "./page-client";

export default async function Page() {
  await requireCoordinatorOrAdmin();
  return <AcademicTermsClient />;
}
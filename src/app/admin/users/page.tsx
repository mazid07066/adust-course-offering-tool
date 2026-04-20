import { requireSuperAdmin } from "@/lib/auth-guard";
import UsersPageClient from "./page-client";

export default async function UsersPage() {
  await requireSuperAdmin();
  return <UsersPageClient />;
}
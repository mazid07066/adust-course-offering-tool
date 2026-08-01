import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import BaeteSettingsClient from "@/components/baete-settings-client";

export default async function BaeteSettingsPage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="BAETE Settings and Configuration"
      phaseLabel="Admin Configuration"
      subtitle="Manage BAETE committees, task groups, criteria, and dynamic configuration records used across the accreditation workspace."
    >
      <BaeteSettingsClient />
    </BaeteWorkspaceShell>
  );
}

import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import BaeteWorkQueueClient from "@/components/baete-work-queue-client";

export default async function BaeteOverduePage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="BAETE Overdue Tasks"
      phaseLabel="Risk Dashboard"
      subtitle="Tasks with past due dates that are not completed. These should be followed up by the coordinator or department head."
    >
      <BaeteWorkQueueClient
        mode="overdue"
        title="Overdue BAETE Task Queue"
        subtitle="Shows live overdue tasks across all modules and committees."
      />
    </BaeteWorkspaceShell>
  );
}

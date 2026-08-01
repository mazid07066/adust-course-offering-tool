import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import BaeteWorkQueueClient from "@/components/baete-work-queue-client";

export default async function BaeteMyTasksPage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="My BAETE Tasks"
      phaseLabel="Assigned Work Queue"
      subtitle="Filter and track BAETE tasks assigned to an individual user. Select a user from the dropdown to view their workload."
    >
      <BaeteWorkQueueClient
        mode="my"
        title="Assigned-Person BAETE Work Queue"
        subtitle="Shows tasks assigned to a selected faculty/user, including priority, timeline, committee, evidence count, and completion status."
      />
    </BaeteWorkspaceShell>
  );
}

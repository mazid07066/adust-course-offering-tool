import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import BaeteWorkQueueClient from "@/components/baete-work-queue-client";

export default async function BaeteReviewQueuePage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="BAETE Evidence Review Queue"
      phaseLabel="Supervisor Review"
      subtitle="Tasks with submitted evidence waiting for supervisor, coordinator, committee head, or department head review."
    >
      <BaeteWorkQueueClient
        mode="review"
        title="Pending Evidence Review Queue"
        subtitle="Shows tasks marked as submitted. Open the module to review uploaded evidence and give Done / Requires update / Needs modification feedback."
      />
    </BaeteWorkspaceShell>
  );
}

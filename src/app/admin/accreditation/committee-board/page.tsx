import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import BaeteWorkQueueClient from "@/components/baete-work-queue-client";

export default async function BaeteCommitteeBoardPage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="BAETE Committee Board"
      phaseLabel="Committee Work Queue"
      subtitle="Committee-wise task board for tracking accreditation responsibilities, evidence readiness, and incomplete actions."
    >
      <BaeteWorkQueueClient
        mode="committee"
        title="Committee-wise BAETE Task Board"
        subtitle="Select a committee to view its assigned BAETE tasks, deadlines, evidence submissions, pending reviews, and completion progress."
      />
    </BaeteWorkspaceShell>
  );
}

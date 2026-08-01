import { requireCoordinatorOrAdmin } from "@/lib/auth-guard";
import BaeteWorkspaceShell from "@/components/baete-accreditation-layout";
import BaeteGanttChart from "@/components/baete-gantt-chart";
import BaeteTaskTracker from "@/components/baete-task-tracker";

export default async function BaeteGanttPage() {
  await requireCoordinatorOrAdmin();

  return (
    <BaeteWorkspaceShell
      title="24-Month BAETE Accreditation Gantt"
      phaseLabel="24-Month Implementation Cycle"
      subtitle="Dynamic Gantt chart generated from admin-created task month/week ranges. Assign committees, upload evidence, review evidence, and track completion."
    >
      <div className="space-y-6">
        <BaeteGanttChart />

        <BaeteTaskTracker
          moduleCode="GANTT_24_MONTH"
          title="24-Month BAETE Accreditation Gantt Tasks"
          subtitle="Create or update month-wise Gantt tasks. The visual chart above is generated from start/end month or week values."
          badge="Gantt"
        />
      </div>
    </BaeteWorkspaceShell>
  );
}

import { NextResponse } from "next/server";
import { requireBaeteWorkspaceApi } from "@/lib/baete-permissions";

export async function GET() {
  const context = await requireBaeteWorkspaceApi();
  if (context instanceof Response) return context;

  return NextResponse.json({
    success: true,
    user: context.user,
    permissions: {
      isSuperAdmin: context.isSuperAdmin,
      isCoordinator: context.isCoordinator,
      isFaculty: context.isFaculty,
      managedCommitteeIds: context.managedCommitteeIds,
      canViewWorkspace: context.canViewWorkspace,
      canManageWorkspace: context.canManageWorkspace,
      canAssignTasks: context.canAssignTasks,
      canReviewAnyEvidence: context.canReviewAnyEvidence,
    },
  });
}

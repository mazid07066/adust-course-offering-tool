import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-session";

export type BaeteSessionUser = {
  id: number;
  role: string;
  email?: string | null;
  name?: string | null;
};

export type BaeteAccessContext = {
  user: BaeteSessionUser;
  isSuperAdmin: boolean;
  isCoordinator: boolean;
  isFaculty: boolean;
  managedCommitteeIds: number[];
  canViewWorkspace: boolean;
  canManageWorkspace: boolean;
  canAssignTasks: boolean;
  canReviewAnyEvidence: boolean;
};

function toBaeteUser(user: any): BaeteSessionUser | null {
  if (!user?.id || !user?.role) return null;

  return {
    id: Number(user.id),
    role: String(user.role).toUpperCase(),
    email: user.email ?? null,
    name: user.name ?? user.full_name ?? user.display_name ?? null,
  };
}

export async function writeBaeteAccessAudit(input: {
  userId?: number | null;
  actionKey: string;
  resourceType?: string | null;
  resourceId?: number | null;
  allowed: boolean;
  reason?: string | null;
}) {
  try {
    await prisma.$executeRaw`
      INSERT INTO baete_access_audit_logs (
        user_id,
        action_key,
        resource_type,
        resource_id,
        allowed,
        reason,
        created_at
      )
      VALUES (
        ${input.userId ?? null},
        ${input.actionKey},
        ${input.resourceType ?? null},
        ${input.resourceId ?? null},
        ${input.allowed},
        ${input.reason ?? null},
        NOW()
      );
    `;
  } catch (error) {
    console.error("BAETE access audit write failed:", error);
  }
}

export async function getBaeteAccessContext(): Promise<
  BaeteAccessContext | NextResponse
> {
  const rawUser = await getSessionUser();
  const user = toBaeteUser(rawUser);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isCoordinator = user.role === "COORDINATOR";
  const isFaculty = user.role === "FACULTY";

  const managedRows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id
    FROM baete_committees
    WHERE is_active = TRUE
      AND (
        head_user_id = ${user.id}
        OR reviewer_user_id = ${user.id}
        OR supervisor_user_id = ${user.id}
      );
  `;

  const managedCommitteeIds = managedRows.map((row) => Number(row.id));

  const canManageWorkspace = isSuperAdmin || isCoordinator;
  const canAssignTasks = isSuperAdmin || isCoordinator;
  const canReviewAnyEvidence = isSuperAdmin || isCoordinator;

  return {
    user,
    isSuperAdmin,
    isCoordinator,
    isFaculty,
    managedCommitteeIds,
    canViewWorkspace:
      isSuperAdmin || isCoordinator || isFaculty || managedCommitteeIds.length > 0,
    canManageWorkspace,
    canAssignTasks,
    canReviewAnyEvidence,
  };
}

export function forbiddenBaeteResponse(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireBaeteWorkspaceApi() {
  const context = await getBaeteAccessContext();

  if (context instanceof Response) return context;

  if (!context.canViewWorkspace) {
    await writeBaeteAccessAudit({
      userId: context.user.id,
      actionKey: "BAETE_WORKSPACE_VIEW",
      allowed: false,
      reason: "User role does not permit BAETE workspace access.",
    });

    return forbiddenBaeteResponse("You are not allowed to access BAETE workspace.");
  }

  return context;
}

export async function requireBaeteManagerApi(actionKey = "BAETE_MANAGE") {
  const context = await getBaeteAccessContext();

  if (context instanceof Response) return context;

  if (!context.canManageWorkspace) {
    await writeBaeteAccessAudit({
      userId: context.user.id,
      actionKey,
      allowed: false,
      reason: "Only Super Admin or Coordinator can manage BAETE records.",
    });

    return forbiddenBaeteResponse(
      "Only Super Admin or Coordinator can perform this action."
    );
  }

  return context;
}

export async function getBaeteTaskPermissionContext(taskId: number) {
  const context = await getBaeteAccessContext();

  if (context instanceof Response) return context;

  const rows = await prisma.$queryRaw<
    Array<{
      id: number;
      assigned_user_id: number | null;
      assigned_committee_id: number | null;
      status: string;
      is_completed: boolean;
    }>
  >`
    SELECT
      id,
      assigned_user_id,
      assigned_committee_id,
      status,
      is_completed
    FROM baete_tasks
    WHERE id = ${taskId}
      AND is_active = TRUE
    LIMIT 1;
  `;

  const task = rows[0];

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const isAssignedUser = Number(task.assigned_user_id || 0) === context.user.id;

  const isCommitteeAuthority =
    Boolean(task.assigned_committee_id) &&
    context.managedCommitteeIds.includes(Number(task.assigned_committee_id));

  const canManage = context.canManageWorkspace;
  const canUpdateOwnTask = canManage || isAssignedUser || isCommitteeAuthority;
  const canUploadEvidence = canManage || isAssignedUser || isCommitteeAuthority;
  const canReviewEvidence = context.canReviewAnyEvidence || isCommitteeAuthority;

  return {
    ...context,
    task,
    isAssignedUser,
    isCommitteeAuthority,
    canManage,
    canUpdateOwnTask,
    canUploadEvidence,
    canReviewEvidence,
  };
}

export async function requireBaeteTaskUpdateApi(taskId: number) {
  const context = await getBaeteTaskPermissionContext(taskId);

  if (context instanceof Response) return context;

  if (!context.canUpdateOwnTask) {
    await writeBaeteAccessAudit({
      userId: context.user.id,
      actionKey: "BAETE_TASK_UPDATE",
      resourceType: "baete_tasks",
      resourceId: taskId,
      allowed: false,
      reason: "User is not manager, assigned user, or committee authority.",
    });

    return forbiddenBaeteResponse(
      "You are not allowed to update this BAETE task."
    );
  }

  return context;
}

export async function requireBaeteTaskManageApi(taskId: number) {
  const context = await getBaeteTaskPermissionContext(taskId);

  if (context instanceof Response) return context;

  if (!context.canManage) {
    await writeBaeteAccessAudit({
      userId: context.user.id,
      actionKey: "BAETE_TASK_MANAGE",
      resourceType: "baete_tasks",
      resourceId: taskId,
      allowed: false,
      reason: "Only Super Admin or Coordinator can structurally manage tasks.",
    });

    return forbiddenBaeteResponse(
      "Only Super Admin or Coordinator can structurally manage BAETE tasks."
    );
  }

  return context;
}

export async function requireBaeteEvidenceUploadApi(taskId: number) {
  const context = await getBaeteTaskPermissionContext(taskId);

  if (context instanceof Response) return context;

  if (!context.canUploadEvidence) {
    await writeBaeteAccessAudit({
      userId: context.user.id,
      actionKey: "BAETE_EVIDENCE_UPLOAD",
      resourceType: "baete_tasks",
      resourceId: taskId,
      allowed: false,
      reason: "User is not allowed to upload evidence for this task.",
    });

    return forbiddenBaeteResponse(
      "You are not allowed to upload evidence for this task."
    );
  }

  return context;
}

export async function requireBaeteEvidenceViewApi(taskId: number) {
  const context = await getBaeteTaskPermissionContext(taskId);

  if (context instanceof Response) return context;

  if (!context.canManage && !context.isAssignedUser && !context.isCommitteeAuthority) {
    await writeBaeteAccessAudit({
      userId: context.user.id,
      actionKey: "BAETE_EVIDENCE_VIEW",
      resourceType: "baete_tasks",
      resourceId: taskId,
      allowed: false,
      reason: "User is not allowed to view evidence for this task.",
    });

    return forbiddenBaeteResponse(
      "You are not allowed to view evidence for this task."
    );
  }

  return context;
}

export async function requireBaeteEvidenceReviewApi(evidenceId: number) {
  const context = await getBaeteAccessContext();

  if (context instanceof Response) return context;

  const rows = await prisma.$queryRaw<
    Array<{
      evidence_id: number;
      task_id: number;
      assigned_committee_id: number | null;
    }>
  >`
    SELECT
      e.id AS evidence_id,
      e.task_id,
      t.assigned_committee_id
    FROM baete_task_evidence e
    JOIN baete_tasks t ON t.id = e.task_id
    WHERE e.id = ${evidenceId}
    LIMIT 1;
  `;

  const evidence = rows[0];

  if (!evidence) {
    return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  }

  const isCommitteeAuthority =
    Boolean(evidence.assigned_committee_id) &&
    context.managedCommitteeIds.includes(Number(evidence.assigned_committee_id));

  const canReview = context.canReviewAnyEvidence || isCommitteeAuthority;

  if (!canReview) {
    await writeBaeteAccessAudit({
      userId: context.user.id,
      actionKey: "BAETE_EVIDENCE_REVIEW",
      resourceType: "baete_task_evidence",
      resourceId: evidenceId,
      allowed: false,
      reason: "User is not allowed to review this evidence.",
    });

    return forbiddenBaeteResponse(
      "You are not allowed to review this evidence."
    );
  }

  return {
    ...context,
    evidence,
    isCommitteeAuthority,
    canReview,
  };
}

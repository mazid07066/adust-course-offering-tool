import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  getFacultyAutoAdvanceOnExpiry,
  getFacultySessionMinutes,
  getFacultyWarningMinutes,
} from "@/lib/system-settings";
import { createFacultyNotification } from "@/lib/faculty-notifications";
import { getCurrentActiveFacultyTurn } from "@/lib/faculty-turn";

export function getRemainingMinutes(expiresAt: Date | string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 60000);
}

export async function revokeExistingFacultySessions(userId: number) {
  await prisma.faculty_login_sessions.updateMany({
    where: {
      user_id: userId,
      revoked_at: null,
      expires_at: {
        gt: new Date(),
      },
    },
    data: {
      revoked_at: new Date(),
    },
  });
}

export async function createFacultyLoginSession(input: {
  userId: number;
  teacherId?: number | null;
}) {
  const sessionMinutes = await getFacultySessionMinutes();
  const expiresAt = new Date(Date.now() + sessionMinutes * 60 * 1000);
  const token = crypto.randomUUID();

  await revokeExistingFacultySessions(input.userId);

  const session = await prisma.faculty_login_sessions.create({
    data: {
      user_id: input.userId,
      teacher_id: input.teacherId ?? null,
      session_token: token,
      expires_at: expiresAt,
    },
  });

  return session;
}

export async function createFacultySession(input: {
  userId: number;
  teacherId?: number | null;
}) {
  return createFacultyLoginSession(input);
}

export async function validateFacultySession(sessionToken: string) {
  const session = await prisma.faculty_login_sessions.findFirst({
    where: {
      session_token: sessionToken,
    },
  });

  if (!session) {
    return {
      valid: false,
      message: "Faculty session was not found.",
      session: null,
    };
  }

  if (session.revoked_at) {
    return {
      valid: false,
      message: "Faculty session is no longer active.",
      session,
    };
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return {
      valid: false,
      message: "Faculty session has expired.",
      session,
    };
  }

  return {
    valid: true,
    message: "",
    session,
  };
}

export async function revokeFacultySession(sessionToken: string) {
  return prisma.faculty_login_sessions.updateMany({
    where: {
      session_token: sessionToken,
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
    },
  });
}

export async function sendFacultyTurnNotification(teacherId: number) {
  const teacher = await prisma.teachers.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      teacher_code: true,
      full_name: true,
    },
  });

  if (!teacher) return;

  const linkedUsers = await prisma.users.findMany({
    where: {
      teacher_id: teacher.id,
      is_active: true,
      role: "FACULTY",
    },
    select: {
      id: true,
    },
  });

  for (const user of linkedUsers) {
    await createFacultyNotification({
      recipientUserId: user.id,
      recipientTeacherId: teacher.id,
      eventType: "FACULTY_TURN_ACTIVE",
      title: "Your faculty choice turn is now active",
      message: `${teacher.teacher_code} - ${teacher.full_name}, your turn is now active. You may save or finalize your course choices now.`,
    });
  }
}

export async function sendFacultyQueueNotification(teacherId: number) {
  const teacher = await prisma.teachers.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      teacher_code: true,
      full_name: true,
    },
  });

  if (!teacher) return;

  const linkedUsers = await prisma.users.findMany({
    where: {
      teacher_id: teacher.id,
      is_active: true,
      role: "FACULTY",
    },
    select: {
      id: true,
    },
  });

  for (const user of linkedUsers) {
    await createFacultyNotification({
      recipientUserId: user.id,
      recipientTeacherId: teacher.id,
      eventType: "FACULTY_TURN_QUEUED",
      title: "Faculty choice session started",
      message: `${teacher.teacher_code} - ${teacher.full_name}, your session is active, but another more senior faculty currently has the editing turn. Please wait for your turn.`,
    });
  }
}

export async function processFacultySessionWarningsAndExpiry(sessionToken: string) {
  const sessionCheck = await validateFacultySession(sessionToken);

  if (!sessionCheck.session) {
    return {
      ok: false,
      expired: false,
      warned: false,
      message: "Faculty session not found.",
    };
  }

  const session = sessionCheck.session;
  const now = new Date();
  const warningMinutes = await getFacultyWarningMinutes();
  const warningThresholdMs = warningMinutes * 60 * 1000;
  const remainingMs = new Date(session.expires_at).getTime() - now.getTime();

  let warned = false;
  let expired = false;
  let message = "";

  if (!session.warned_at && remainingMs > 0 && remainingMs <= warningThresholdMs) {
    await prisma.faculty_login_sessions.update({
      where: { id: session.id },
      data: {
        warned_at: now,
      },
    });

    if (session.teacher_id) {
      const linkedUsers = await prisma.users.findMany({
        where: {
          teacher_id: session.teacher_id,
          is_active: true,
          role: "FACULTY",
        },
        select: { id: true },
      });

      for (const user of linkedUsers) {
        await createFacultyNotification({
          recipientUserId: user.id,
          recipientTeacherId: session.teacher_id,
          eventType: "FACULTY_TURN_WARNING",
          title: "Faculty choice session warning",
          message: `Your session will expire in about ${warningMinutes} minute(s). Please finalize or save your work now.`,
        });
      }
    }

    warned = true;
    message = `Warning notification sent at ${warningMinutes} minute threshold.`;
  }

  if (remainingMs <= 0 && !session.revoked_at) {
    await prisma.faculty_login_sessions.update({
      where: { id: session.id },
      data: {
        revoked_at: now,
      },
    });

    if (session.teacher_id) {
      const linkedUsers = await prisma.users.findMany({
        where: {
          teacher_id: session.teacher_id,
          is_active: true,
          role: "FACULTY",
        },
        select: { id: true },
      });

      for (const user of linkedUsers) {
        await createFacultyNotification({
          recipientUserId: user.id,
          recipientTeacherId: session.teacher_id,
          eventType: "FACULTY_TURN_EXPIRED",
          title: "Faculty choice session expired",
          message: "Your faculty choice session expired. You were moved out of the active queue.",
        });
      }
    }

    const autoAdvance = await getFacultyAutoAdvanceOnExpiry();

    if (autoAdvance) {
      const nextTurn = await getCurrentActiveFacultyTurn();
      if (nextTurn?.teacherId) {
        await sendFacultyTurnNotification(nextTurn.teacherId);
      }
    }

    expired = true;
    message = "Faculty session expired and was revoked.";
  }

  return {
    ok: true,
    expired,
    warned,
    message,
  };
}
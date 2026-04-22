import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  getFacultyAutoAdvanceOnExpiry,
  getFacultySessionMinutes,
  getFacultyWarningMinutes,
  getActiveFacultyTeacherId,
  setSetting,
} from "@/lib/system-settings";
import { createFacultyNotification } from "@/lib/faculty-notifications";

type CreateFacultySessionInput =
  | number
  | {
      userId: number;
      teacherId?: number | null;
    };

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

  return {
    ...session,
    sessionToken: session.session_token,
    expiresAt: session.expires_at,
    userId: session.user_id,
    teacherId: session.teacher_id,
    revokedAt: session.revoked_at,
    warnedAt: session.warned_at,
    createdAt: session.created_at,
  };
}

/**
 * Backward-compatible wrapper.
 * Supports both:
 *   createFacultySession(5)
 * and
 *   createFacultySession({ userId: 5, teacherId: 2 })
 */
export async function createFacultySession(input: CreateFacultySessionInput) {
  if (typeof input === "number") {
    return createFacultyLoginSession({
      userId: input,
      teacherId: null,
    });
  }

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

export async function processFacultySessionWarningsAndExpiry(
  sessionToken: string
) {
  const validation = await validateFacultySession(sessionToken);

  if (!validation.session) {
    return {
      ok: false,
      expired: false,
      warned: false,
      message: validation.message,
    };
  }

  const session = validation.session;
  const remainingMinutes = getRemainingMinutes(session.expires_at);
  const warningMinutes = await getFacultyWarningMinutes();

  let warned = false;
  let expired = false;
  let message = "";

  if (
    remainingMinutes > 0 &&
    remainingMinutes <= warningMinutes &&
    !session.warned_at
  ) {
    await prisma.faculty_login_sessions.update({
      where: { id: session.id },
      data: {
        warned_at: new Date(),
      },
    });

    if (session.user_id || session.teacher_id) {
      await createFacultyNotification({
        recipientUserId: session.user_id,
        recipientTeacherId: session.teacher_id,
        eventType: "FACULTY_SESSION_WARNING",
        title: "Faculty choice session warning",
        message: `Your faculty choice session will expire in ${remainingMinutes} minute(s). Please save or finalize your work soon.`,
      });
    }

    warned = true;
  }

  if (remainingMinutes <= 0 && !session.revoked_at) {
    await prisma.faculty_login_sessions.update({
      where: { id: session.id },
      data: {
        revoked_at: new Date(),
      },
    });

    expired = true;
    message = "Faculty session expired and was closed automatically.";

    if (session.user_id || session.teacher_id) {
      await createFacultyNotification({
        recipientUserId: session.user_id,
        recipientTeacherId: session.teacher_id,
        eventType: "FACULTY_SESSION_EXPIRED",
        title: "Faculty choice session expired",
        message:
          "Your faculty choice session expired. Please wait for the next active turn or log in again when allowed.",
      });
    }

    const autoAdvance = await getFacultyAutoAdvanceOnExpiry();

    if (autoAdvance) {
      const activeTeacherId = await getActiveFacultyTeacherId();

      if (
        activeTeacherId &&
        session.teacher_id &&
        activeTeacherId === session.teacher_id
      ) {
        await setSetting("FACULTY_ACTIVE_TEACHER_ID", "");
      }
    }
  }

  return {
    ok: true,
    expired,
    warned,
    message,
  };
}
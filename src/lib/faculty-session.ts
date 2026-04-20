import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getFacultySessionMinutes } from "./system-settings";

export async function createFacultySession(userId: number) {
  // revoke previous active sessions
  await prisma.facultyLoginSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  const minutes = await getFacultySessionMinutes();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + minutes * 60 * 1000);

  const sessionToken = crypto.randomUUID();

  const session = await prisma.facultyLoginSession.create({
    data: {
      userId,
      sessionToken,
      expiresAt,
    },
  });

  return session;
}

export async function getActiveFacultySession(sessionToken: string) {
  const session = await prisma.facultyLoginSession.findUnique({
    where: { sessionToken },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (new Date() > session.expiresAt) return null;

  return session;
}

export async function validateFacultySession(sessionToken: string) {
  const session = await getActiveFacultySession(sessionToken);

  if (!session) {
    return {
      valid: false,
      message: "Session expired. Please login again.",
    };
  }

  return {
    valid: true,
    session,
  };
}

export function getRemainingMinutes(expiresAt: Date): number {
  const now = new Date().getTime();
  const exp = new Date(expiresAt).getTime();

  const diff = exp - now;
  if (diff <= 0) return 0;

  return Math.floor(diff / 60000);
}

export async function revokeSession(sessionToken: string) {
  return prisma.facultyLoginSession.update({
    where: { sessionToken },
    data: {
      revokedAt: new Date(),
    },
  });
}
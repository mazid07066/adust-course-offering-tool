import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean | null;
  teacher_id: number | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("sessionToken")?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.facultyLoginSession.findUnique({
    where: { sessionToken },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.revokedAt) {
    return null;
  }

  if (new Date() > session.expiresAt) {
    return null;
  }

  if (!session.user || !session.user.is_active) {
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    full_name: session.user.full_name,
    role: session.user.role,
    is_active: session.user.is_active,
    teacher_id: session.user.teacher_id,
  };
}
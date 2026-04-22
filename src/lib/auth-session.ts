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

  const session = await prisma.faculty_login_sessions.findUnique({
    where: {
      session_token: sessionToken,
    },
  });

  if (!session) {
    return null;
  }

  if (session.revoked_at) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const user = await prisma.users.findUnique({
    where: {
      id: session.user_id,
    },
    select: {
      id: true,
      username: true,
      full_name: true,
      role: true,
      is_active: true,
      teacher_id: true,
    },
  });

  if (!user || !user.is_active) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    teacher_id: user.teacher_id ?? null,
  };
}
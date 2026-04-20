import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  const cookieStore = await cookies(); // ✅ FIXED

  const token = cookieStore.get("sessionToken")?.value;

  if (!token) return null;

  const session = await prisma.facultyLoginSession.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (new Date() > session.expiresAt) return null;

  return session.user;
}
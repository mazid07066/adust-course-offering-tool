import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("sessionToken")?.value;

  if (sessionToken) {
    await prisma.faculty_login_sessions.updateMany({
      where: {
        session_token: sessionToken,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });
  }

  const res = NextResponse.json({ success: true });

  res.cookies.set("sessionToken", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });

  return res;
}
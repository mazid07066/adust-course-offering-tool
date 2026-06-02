import { NextResponse } from "next/server";
import {
  revokeCurrentStudentSession,
  STUDENT_SESSION_COOKIE,
} from "@/lib/student-session";

export async function POST() {
  await revokeCurrentStudentSession();

  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully.",
  });

  response.cookies.set(STUDENT_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
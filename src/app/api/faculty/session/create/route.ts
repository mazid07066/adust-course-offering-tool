import { NextRequest, NextResponse } from "next/server";
import { createFacultyLoginSession } from "@/lib/faculty-session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = Number(body.userId);
    const teacherId =
      body.teacherId === null || body.teacherId === undefined || body.teacherId === ""
        ? null
        : Number(body.teacherId);

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const session = await createFacultyLoginSession({
      userId,
      teacherId,
    });

    return NextResponse.json({
      success: true,
      sessionToken: session.session_token,
      expiresAt: session.expires_at,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createFacultySession } from "@/lib/faculty-session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const session = await createFacultySession(userId);

    return NextResponse.json({
      success: true,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { validateFacultySession, getRemainingMinutes } from "@/lib/faculty-session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionToken = String(body.sessionToken || "").trim();

    if (!sessionToken) {
      return NextResponse.json({ valid: false });
    }

    const result = await validateFacultySession(sessionToken);

    if (!result.valid || !result.session) {
      return NextResponse.json({
        valid: false,
        message: result.message,
      });
    }

    return NextResponse.json({
      valid: true,
      remainingMinutes: getRemainingMinutes(result.session.expires_at),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ valid: false });
  }
}
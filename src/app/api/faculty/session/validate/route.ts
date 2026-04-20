import { NextRequest, NextResponse } from "next/server";
import { validateFacultySession, getRemainingMinutes } from "@/lib/faculty-session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json({ valid: false });
    }

    const result = await validateFacultySession(sessionToken);

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        message: result.message,
      });
    }

    return NextResponse.json({
      valid: true,
      remainingMinutes: getRemainingMinutes(result.session.expiresAt),
    });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
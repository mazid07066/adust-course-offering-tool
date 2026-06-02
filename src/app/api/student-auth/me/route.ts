import { NextResponse } from "next/server";
import { getStudentSession, isStudentPortalEnabled } from "@/lib/student-session";

export async function GET() {
  const portal = await isStudentPortalEnabled();

  if (!portal.enabled) {
    return NextResponse.json(
      {
        authenticated: false,
        portalEnabled: false,
        message: portal.message,
      },
      { status: 403 }
    );
  }

  const session = await getStudentSession();

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        portalEnabled: true,
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    portalEnabled: true,
    student: session,
  });
}
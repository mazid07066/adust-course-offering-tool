import { NextResponse } from "next/server";
import { getSessionUser } from "./auth-session";
import { getFacultyChoiceWindowStatus } from "./system-settings";
import { validateFacultySession } from "./faculty-session";
import { cookies } from "next/headers";

export async function requireFacultyAction() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "FACULTY") {
    return NextResponse.json({ error: "Only faculty allowed" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("sessionToken")?.value;

  if (!token) {
    return NextResponse.json({ error: "Session missing" }, { status: 401 });
  }

  const sessionCheck = await validateFacultySession(token);

  if (!sessionCheck.valid) {
    return NextResponse.json(
      { error: "Session expired. Please login again." },
      { status: 401 }
    );
  }

  const windowStatus = await getFacultyChoiceWindowStatus();

  if (windowStatus !== "OPEN") {
    return NextResponse.json(
      { error: "Faculty choice window is closed." },
      { status: 403 }
    );
  }

  return {
    user,
    session: sessionCheck.session,
  };
}
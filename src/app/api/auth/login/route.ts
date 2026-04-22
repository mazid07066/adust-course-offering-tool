import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  createFacultyLoginSession,
  sendFacultyQueueNotification,
  sendFacultyTurnNotification,
} from "@/lib/faculty-session";
import { getCurrentActiveFacultyTurn } from "@/lib/faculty-turn";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.users.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        full_name: true,
        password_hash: true,
        role: true,
        is_active: true,
        teacher_id: true,
      },
    });

    if (!user || !user.is_active) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    // Create a session for ALL roles, not only faculty.
    const appSession = await createFacultyLoginSession({
      userId: user.id,
      teacherId: user.teacher_id ?? null,
    });

    // Only faculty users participate in faculty-turn notifications.
    if (user.role === "FACULTY" && user.teacher_id) {
      const activeTurn = await getCurrentActiveFacultyTurn();

      if (activeTurn?.teacherId === user.teacher_id) {
        await sendFacultyTurnNotification(user.teacher_id);
      } else {
        await sendFacultyQueueNotification(user.teacher_id);
      }
    }

    const res = NextResponse.json({
      success: true,
      role: user.role,
      expiresAt: appSession.expires_at,
    });

    res.cookies.set("sessionToken", appSession.session_token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });

    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
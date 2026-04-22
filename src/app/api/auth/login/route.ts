import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createFacultySession } from "@/lib/faculty-session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

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
        password_hash: true,
        role: true,
        is_active: true,
        teacher_id: true,
      },
    });

    if (!user || !user.is_active) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const session = await createFacultySession({
      userId: user.id,
      teacherId: user.teacher_id ?? null,
    });

    const res = NextResponse.json({
      success: true,
      role: user.role,
    });

    res.cookies.set("sessionToken", session.session_token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
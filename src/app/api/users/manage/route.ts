import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireSuperAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const users = await prisma.users.findMany({
      include: {
        teachers: true,
      },
      orderBy: [{ id: "asc" }],
    });

    const faculties = await prisma.teachers.findMany({
      orderBy: [{ teacher_code: "asc" }],
    });

    return NextResponse.json({
      success: true,
      users,
      faculties,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load users." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();

    const {
      username,
      full_name,
      password,
      role,
      teacher_id,
      is_active,
    }: {
      username: string;
      full_name: string;
      password: string;
      role: string;
      teacher_id?: number | null;
      is_active?: boolean;
    } = body;

    const cleanUsername = username?.trim();
    const cleanFullName = full_name?.trim();
    const cleanRole = role?.trim().toUpperCase();

    if (!cleanUsername || !cleanFullName || !password || !cleanRole) {
      return NextResponse.json(
        { error: "username, full_name, password, and role are required." },
        { status: 400 }
      );
    }

    if (!["SUPER_ADMIN", "COORDINATOR", "FACULTY"].includes(cleanRole)) {
      return NextResponse.json(
        { error: "Invalid role." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (cleanRole === "FACULTY" && !teacher_id) {
      return NextResponse.json(
        { error: "Faculty role requires a linked faculty member." },
        { status: 400 }
      );
    }

    if (teacher_id) {
      const teacher = await prisma.teachers.findUnique({
        where: { id: teacher_id },
      });

      if (!teacher) {
        return NextResponse.json(
          { error: "Linked faculty not found." },
          { status: 404 }
        );
      }

      const existingLinkedUser = await prisma.users.findFirst({
        where: {
          teacher_id,
        },
      });

      if (existingLinkedUser) {
        return NextResponse.json(
          { error: "This faculty member is already linked to another user." },
          { status: 400 }
        );
      }
    }

    const existingUser = await prisma.users.findUnique({
      where: { username: cleanUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists." },
        { status: 400 }
      );
    }

    const password_hash = await bcrypt.hash(password, 10);

    const created = await prisma.users.create({
      data: {
        username: cleanUsername,
        full_name: cleanFullName,
        password_hash,
        role: cleanRole,
        teacher_id: teacher_id || null,
        is_active: is_active ?? true,
      },
      include: {
        teachers: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: created,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create user." },
      { status: 500 }
    );
  }
}
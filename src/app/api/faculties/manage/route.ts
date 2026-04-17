import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  await requireCoordinatorOrAdminApi();

  try {
    const faculties = await prisma.teachers.findMany({
      include: {
        departments: true,
      },
      orderBy: [
        { teacher_code: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      faculties,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load faculties",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await request.json();

    const {
      department_id,
      teacher_code,
      full_name,
      designation,
      email,
    }: {
      department_id: number;
      teacher_code: string;
      full_name: string;
      designation?: string | null;
      email?: string | null;
    } = body;

    if (!department_id || !teacher_code || !full_name) {
      return NextResponse.json(
        { error: "department_id, teacher_code, and full_name are required" },
        { status: 400 }
      );
    }

    const created = await prisma.teachers.create({
      data: {
        department_id,
        teacher_code: teacher_code.trim().toUpperCase(),
        full_name: full_name.trim(),
        designation: designation?.trim() || null,
        email: email?.trim() || null,
        is_active: true,
      },
    });

    return NextResponse.json({
      success: true,
      faculty: created,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create faculty",
      },
      { status: 500 }
    );
  }
}
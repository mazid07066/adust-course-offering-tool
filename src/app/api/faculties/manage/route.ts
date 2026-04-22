import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const faculties = await prisma.teachers.findMany({
      include: {
        departments: true,
      },
      orderBy: [{ teacher_code: "asc" }],
    });

    return NextResponse.json({
      success: true,
      faculties,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculties" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();

    const {
      department_id,
      teacher_code,
      full_name,
      designation,
      email,
      phone,
      seniority_level,
    } = body;

    if (!department_id || !teacher_code || !full_name) {
      return NextResponse.json(
        { error: "department_id, teacher_code, full_name required" },
        { status: 400 }
      );
    }

    const created = await prisma.teachers.create({
      data: {
        department_id: Number(department_id),
        teacher_code: String(teacher_code).trim().toUpperCase(),
        full_name: String(full_name).trim(),
        designation: designation?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        seniority_level:
          seniority_level === "" || seniority_level === null || seniority_level === undefined
            ? null
            : Number(seniority_level),
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
      { error: "Failed to create faculty" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
      { error: "Failed to load faculties." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();

    const department_id = Number(body.department_id);
    const teacher_code = String(body.teacher_code || "").trim().toUpperCase();
    const full_name = String(body.full_name || "").trim();
    const designation = normalizeNullableString(body.designation);
    const email = normalizeNullableString(body.email);
    const phone = normalizeNullableString(body.phone);

    if (!department_id || !teacher_code || !full_name) {
      return NextResponse.json(
        { error: "Department, faculty code, and full name are required." },
        { status: 400 }
      );
    }

    const department = await prisma.departments.findUnique({
      where: { id: department_id },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Selected department does not exist." },
        { status: 404 }
      );
    }

    const existingCode = await prisma.teachers.findUnique({
      where: { teacher_code },
    });

    if (existingCode) {
      return NextResponse.json(
        { error: "Faculty code already exists." },
        { status: 400 }
      );
    }

    const created = await prisma.teachers.create({
      data: {
        department_id,
        teacher_code,
        full_name,
        designation,
        email,
        phone,
        is_active: true,
      },
      include: {
        departments: true,
      },
    });

    return NextResponse.json({
      success: true,
      faculty: created,
      message: "Faculty created successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create faculty." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const faculties = await prisma.teachers.findMany({
      where: {
        is_active: true,
      },
      include: {
        departments: true,
      },
      orderBy: [
        { teacher_code: "asc" }
      ],
    });

    return NextResponse.json({
      success: true,
      faculties: faculties.map((f) => ({
        id: f.id,
        teacherCode: f.teacher_code,
        teacher_code: f.teacher_code,
        fullName: f.full_name,
        full_name: f.full_name,
        designation: f.designation || null,
        departmentCode: f.departments?.short_name || null,
        department_code: f.departments?.short_name || null,
        seniorityLevel: f.seniority_level ?? null,
        seniority_level: f.seniority_level ?? null,
        email: f.email || null,
        phone: f.phone || null,
        isActive: f.is_active,
        is_active: f.is_active,
      })),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load faculties.",
      },
      { status: 500 }
    );
  }
}
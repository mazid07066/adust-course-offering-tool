import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const teachers = await prisma.teachers.findMany({
      where: {
        is_active: {
          not: false,
        },
      },
      select: {
        id: true,
        teacher_code: true,
        full_name: true,
        designation: true,
        email: true,
        phone: true,
      },
      orderBy: [{ teacher_code: "asc" }, { full_name: "asc" }],
    });

    return NextResponse.json({
      success: true,
      teachers,
      statuses: [
        "ACTIVE",
        "INACTIVE",
        "DROPPED",
        "SUSPENDED",
        "COMPLETED",
        "TRANSFERRED",
      ],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student detail options." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  await requireCoordinatorOrAdminApi();

  try {
    const faculties = await prisma.teachers.findMany({
      where: {
        is_active: true,
      },
      orderBy: [
        { full_name: "asc" },
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
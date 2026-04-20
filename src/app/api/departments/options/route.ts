import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const departments = await prisma.departments.findMany({
      orderBy: { short_name: "asc" },
    });

    return NextResponse.json({
      success: true,
      departments,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load departments.",
      },
      { status: 500 }
    );
  }
}
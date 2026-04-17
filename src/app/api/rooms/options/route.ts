import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  await requireCoordinatorOrAdminApi();

  try {
    const rooms = await prisma.rooms.findMany({
      where: {
        is_active: true,
      },
      orderBy: [
        { room_code: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      rooms,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load rooms",
      },
      { status: 500 }
    );
  }
}
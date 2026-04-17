import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await requireCoordinatorOrAdminApi();

  try {
    const { id } = await context.params;
    const roomId = Number(id);

    if (!roomId) {
      return NextResponse.json({ error: "Invalid room id" }, { status: 400 });
    }

    await prisma.rooms.delete({
      where: { id: roomId },
    });

    return NextResponse.json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete room",
      },
      { status: 500 }
    );
  }
}
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
    const facultyId = Number(id);

    if (!facultyId) {
      return NextResponse.json({ error: "Invalid faculty id" }, { status: 400 });
    }

    await prisma.teachers.delete({
      where: { id: facultyId },
    });

    return NextResponse.json({
      success: true,
      message: "Faculty deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete faculty",
      },
      { status: 500 }
    );
  }
}
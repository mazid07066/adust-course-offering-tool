import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi } from "@/lib/auth-guard";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireSuperAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const userId = Number(id);

    if (!userId) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    if (userId === guard.id) {
      return NextResponse.json(
        { error: "You cannot delete your own active login account." },
        { status: 400 }
      );
    }

    await prisma.users.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete user." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireSuperAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const userId = Number(id);

    if (!userId) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const body = await request.json();
    const { is_active } = body as { is_active?: boolean };

    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        is_active: Boolean(is_active),
      },
      include: {
        teachers: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updated,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update user." },
      { status: 500 }
    );
  }
}
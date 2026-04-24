import { NextResponse } from "next/server";
import { requireFacultyApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    await prisma.notifications.updateMany({
      where: {
        is_read: false,
        OR: [
          { recipient_user_id: guard.id },
          guard.teacher_id ? { recipient_teacher_id: guard.teacher_id } : undefined,
        ].filter(Boolean) as any,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to clear notifications." },
      { status: 500 }
    );
  }
}
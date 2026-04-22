import { NextResponse } from "next/server";
import { requireFacultyApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    const items = await prisma.notifications.findMany({
      where: {
        OR: [
          { recipient_user_id: guard.id },
          guard.teacher_id ? { recipient_teacher_id: guard.teacher_id } : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: [{ created_at: "desc" }],
      take: 50,
    });

    return NextResponse.json({
      success: true,
      notifications: items,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load notifications." },
      { status: 500 }
    );
  }
}
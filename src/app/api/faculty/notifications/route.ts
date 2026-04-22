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
          guard.id ? { recipient_user_id: Number(guard.id) } : undefined,
          guard.teacher_id ? { recipient_teacher_id: Number(guard.teacher_id) } : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: [{ created_at: "desc" }],
      take: 30,
    });

    return NextResponse.json({
      success: true,
      notifications: items,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load notifications." },
      { status: 500 }
    );
  }
}
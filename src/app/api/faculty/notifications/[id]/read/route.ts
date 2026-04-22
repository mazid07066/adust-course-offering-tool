import { NextRequest, NextResponse } from "next/server";
import { requireFacultyApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { markNotificationRead } from "@/lib/faculty-notifications";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const notificationId = Number(id);

    if (!notificationId) {
      return NextResponse.json(
        { error: "Invalid notification id." },
        { status: 400 }
      );
    }

    const notification = await prisma.notifications.findFirst({
      where: {
        id: notificationId,
        OR: [
          { recipient_user_id: guard.id },
          guard.teacher_id
            ? { recipient_teacher_id: guard.teacher_id }
            : undefined,
        ].filter(Boolean) as any,
      },
      select: {
        id: true,
        is_read: true,
      },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 }
      );
    }

    if (!notification.is_read) {
      await markNotificationRead(notificationId);
    }

    return NextResponse.json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to mark notification as read." },
      { status: 500 }
    );
  }
}
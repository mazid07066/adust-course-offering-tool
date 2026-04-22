import { NextRequest, NextResponse } from "next/server";
import { requireFacultyApi } from "@/lib/auth-guard";
import { markNotificationRead } from "@/lib/faculty-notifications";

export async function POST(
  _request: NextRequest,
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

    await markNotificationRead(notificationId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to mark notification as read." },
      { status: 500 }
    );
  }
}
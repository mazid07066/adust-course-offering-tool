import { NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getCurrentActiveFacultyTurn,
  getEligibleFacultyTurnQueue,
} from "@/lib/faculty-turn";
import { getRemainingMinutes } from "@/lib/faculty-session";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const activeTurn = await getCurrentActiveFacultyTurn();
    const queue = await getEligibleFacultyTurnQueue();

    return NextResponse.json({
      success: true,
      activeTurn: activeTurn
        ? {
            teacherId: activeTurn.teacherId,
            userId: activeTurn.userId,
            teacherCode: activeTurn.teacherCode,
            fullName: activeTurn.fullName,
            seniorityLevel: activeTurn.seniorityLevel,
            sessionId: activeTurn.sessionId,
            sessionCreatedAt: activeTurn.sessionCreatedAt,
            sessionExpiresAt: activeTurn.sessionExpiresAt,
            remainingMinutes: getRemainingMinutes(activeTurn.sessionExpiresAt),
          }
        : null,
      queue: queue.map((item, index) => ({
        rank: index + 1,
        teacherId: item.teacherId,
        userId: item.userId,
        teacherCode: item.teacherCode,
        fullName: item.fullName,
        seniorityLevel: item.seniorityLevel,
        sessionId: item.sessionId,
        sessionCreatedAt: item.sessionCreatedAt,
        sessionExpiresAt: item.sessionExpiresAt,
        remainingMinutes: getRemainingMinutes(item.sessionExpiresAt),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculty turn status." },
      { status: 500 }
    );
  }
}
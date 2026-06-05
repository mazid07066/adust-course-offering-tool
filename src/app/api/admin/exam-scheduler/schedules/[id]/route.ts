import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const scheduleId = Number(id);

    if (!Number.isFinite(scheduleId)) {
      return NextResponse.json(
        { error: "Invalid schedule id." },
        { status: 400 }
      );
    }

    const schedules = await prisma.$queryRaw<any[]>`
      SELECT
        es.*,
        at.name AS term_name
      FROM exam_schedules es
      JOIN academic_terms at ON at.id = es.academic_term_id
      WHERE es.id = ${scheduleId}
      LIMIT 1;
    `;

    const schedule = schedules[0];

    if (!schedule) {
      return NextResponse.json(
        { error: "Exam schedule not found." },
        { status: 404 }
      );
    }

    const items = await prisma.$queryRaw<any[]>`
      SELECT
        esi.*
      FROM exam_schedule_items esi
      WHERE esi.exam_schedule_id = ${scheduleId}
      ORDER BY esi.exam_date ASC, esi.start_time ASC, esi.room_code ASC, esi.course_code ASC;
    `;

    return NextResponse.json({
      success: true,
      schedule,
      items,
    });
  } catch (error) {
    console.error("Exam schedule detail error:", error);
    return NextResponse.json(
      { error: "Failed to load exam schedule." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const scheduleId = Number(id);

    if (!Number.isFinite(scheduleId)) {
      return NextResponse.json(
        { error: "Invalid schedule id." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      DELETE FROM exam_schedules
      WHERE id = ${scheduleId};
    `;

    return NextResponse.json({
      success: true,
      message: "Exam schedule deleted successfully.",
    });
  } catch (error) {
    console.error("Exam schedule delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete exam schedule." },
      { status: 500 }
    );
  }
}
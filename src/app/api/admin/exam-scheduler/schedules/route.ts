import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const schedules = await prisma.$queryRaw<any[]>`
      SELECT
        es.id,
        es.title,
        es.exam_type,
        es.status,
        es.max_exams_per_batch_per_day,
        es.created_at,
        es.updated_at,
        at.name AS term_name,
        COUNT(esi.id)::int AS item_count
      FROM exam_schedules es
      JOIN academic_terms at ON at.id = es.academic_term_id
      LEFT JOIN exam_schedule_items esi ON esi.exam_schedule_id = es.id
      GROUP BY es.id, at.name
      ORDER BY es.id DESC;
    `;

    return NextResponse.json({
      success: true,
      schedules,
    });
  } catch (error) {
    console.error("Exam schedule list error:", error);
    return NextResponse.json(
      { error: "Failed to load exam schedules." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { validateExamItemMove } from "@/lib/exam-scheduler";

function splitBatchCodes(value: string) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id, itemId } = await context.params;
    const scheduleId = Number(id);
    const movingItemId = Number(itemId);

    if (!Number.isFinite(scheduleId) || !Number.isFinite(movingItemId)) {
      return NextResponse.json(
        { error: "Invalid schedule or item id." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const examDate = String(body.examDate || "").trim();
    const startTime = String(body.startTime || "").trim();
    const endTime = String(body.endTime || "").trim();
    const roomId = Number(body.roomId || 0);
    const seatPlanNote = String(body.seatPlanNote || "").trim();

    if (!examDate || !startTime || !endTime || !roomId) {
      return NextResponse.json(
        { error: "Exam date, start time, end time, and room are required." },
        { status: 400 }
      );
    }

    const schedules = await prisma.$queryRaw<any[]>`
      SELECT id, max_exams_per_batch_per_day
      FROM exam_schedules
      WHERE id = ${scheduleId}
      LIMIT 1;
    `;

    const schedule = schedules[0];

    if (!schedule) {
      return NextResponse.json(
        { error: "Exam schedule not found." },
        { status: 404 }
      );
    }

    const itemRows = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM exam_schedule_items
      WHERE id = ${movingItemId}
        AND exam_schedule_id = ${scheduleId}
      LIMIT 1;
    `;

    const movingItem = itemRows[0];

    if (!movingItem) {
      return NextResponse.json(
        { error: "Exam schedule item not found." },
        { status: 404 }
      );
    }

    const roomRows = await prisma.$queryRaw<any[]>`
      SELECT id, room_code, capacity
      FROM rooms
      WHERE id = ${roomId}
      LIMIT 1;
    `;

    const room = roomRows[0];

    if (!room) {
      return NextResponse.json(
        { error: "Selected room not found." },
        { status: 404 }
      );
    }

    if (Number(movingItem.student_count || 0) > Number(room.capacity || 0)) {
      return NextResponse.json(
        {
          error: `Room ${room.room_code} capacity is not enough for ${movingItem.student_count} students.`,
        },
        { status: 400 }
      );
    }

    const allRows = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        batch_codes,
        exam_date,
        start_time,
        end_time,
        room_id
      FROM exam_schedule_items
      WHERE exam_schedule_id = ${scheduleId};
    `;

    const validation = validateExamItemMove({
      movingItemId,
      maxExamsPerBatchPerDay: Number(
        schedule.max_exams_per_batch_per_day || 1
      ),
      items: allRows.map((row) => ({
        id: Number(row.id),
        batchCodes: splitBatchCodes(row.batch_codes),
        examDate: String(row.exam_date).slice(0, 10),
        startTime: row.start_time,
        endTime: row.end_time,
        roomId: row.room_id ? Number(row.room_id) : null,
      })),
      next: {
        batchCodes: splitBatchCodes(movingItem.batch_codes),
        examDate,
        startTime,
        endTime,
        roomId,
      },
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await prisma.$executeRaw`
      UPDATE exam_schedule_items
      SET
        exam_date = ${examDate}::date,
        start_time = ${startTime},
        end_time = ${endTime},
        room_id = ${roomId},
        room_code = ${room.room_code},
        room_capacity = ${Number(room.capacity || 0)},
        seat_plan_note = ${seatPlanNote},
        updated_at = NOW()
      WHERE id = ${movingItemId}
        AND exam_schedule_id = ${scheduleId};
    `;

    return NextResponse.json({
      success: true,
      message: "Exam schedule item updated successfully.",
    });
  } catch (error) {
    console.error("Exam schedule item update error:", error);
    return NextResponse.json(
      { error: "Failed to update exam schedule item." },
      { status: 500 }
    );
  }
}
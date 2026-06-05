import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { generateExamSchedule } from "@/lib/exam-scheduler";

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const title = String(body.title || "").trim();
    const examType = String(body.examType || "FINAL").trim().toUpperCase();
    const termName = String(body.termName || "").trim().toUpperCase();

    const programIds = Array.isArray(body.programIds)
      ? body.programIds.map(Number).filter((x: number) => Number.isFinite(x))
      : [];

    const dates = Array.isArray(body.dates)
      ? body.dates.map((x: string) => String(x).trim()).filter(Boolean)
      : [];

    const slots = Array.isArray(body.slots) ? body.slots : [];
    const rooms = Array.isArray(body.rooms) ? body.rooms : [];
    const courses = Array.isArray(body.courses) ? body.courses : [];

    const maxExamsPerBatchPerDay = Math.max(
      1,
      Number(body.maxExamsPerBatchPerDay || 1)
    );

    if (!title) {
      return NextResponse.json(
        { error: "Schedule title is required." },
        { status: 400 }
      );
    }

    if (!termName) {
      return NextResponse.json(
        { error: "Academic term is required." },
        { status: 400 }
      );
    }

    if (programIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one program." },
        { status: 400 }
      );
    }

    const term = await prisma.academic_terms.findFirst({
      where: { name: termName },
      select: { id: true, name: true },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const result = generateExamSchedule({
      courses,
      dates,
      slots,
      rooms,
      maxExamsPerBatchPerDay,
    });

    const scheduleRows = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO exam_schedules (
        title,
        academic_term_id,
        exam_type,
        status,
        max_exams_per_batch_per_day,
        program_ids_json,
        exam_dates_json,
        exam_slots_json,
        room_ids_json,
        created_at,
        updated_at
      )
      VALUES (
        ${title},
        ${term.id},
        ${examType},
        'DRAFT',
        ${maxExamsPerBatchPerDay},
        ${JSON.stringify(programIds)},
        ${JSON.stringify(dates)},
        ${JSON.stringify(slots)},
        ${JSON.stringify(rooms.map((room: any) => Number(room.id)))},
        NOW(),
        NOW()
      )
      RETURNING id;
    `;

    const scheduleId = scheduleRows[0].id;

    for (const item of result.items) {
      await prisma.$executeRaw`
        INSERT INTO exam_schedule_items (
          exam_schedule_id,
          offered_course_id,
          program_id,
          course_code,
          course_title,
          section,
          batch_codes,
          student_count,
          exam_date,
          start_time,
          end_time,
          room_id,
          room_code,
          room_capacity,
          seat_plan_note,
          created_at,
          updated_at
        )
        VALUES (
          ${scheduleId},
          ${item.offeredCourseId},
          ${item.programId},
          ${item.courseCode},
          ${item.courseTitle},
          ${item.section},
          ${item.batchCodes.join(", ")},
          ${Number(item.studentCount || 0)},
          ${item.examDate}::date,
          ${item.startTime},
          ${item.endTime},
          ${item.roomId},
          ${item.roomCode},
          ${Number(item.roomCapacity || 0)},
          ${item.seatPlanNote || ""},
          NOW(),
          NOW()
        );
      `;
    }

    return NextResponse.json({
      success: true,
      scheduleId,
      result,
      message:
        result.unscheduled.length > 0
          ? "Schedule generated with some unscheduled course sections."
          : "Exam schedule generated successfully.",
    });
  } catch (error) {
    console.error("Exam schedule generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate exam schedule." },
      { status: 500 }
    );
  }
}
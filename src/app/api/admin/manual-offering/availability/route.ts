import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { SCHEDULE_CONFLICT_STATUSES } from "@/lib/course-schedule-policy";

function normalizeUpper(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

const DAY_ORDER: Record<string, number> = {
  SATURDAY: 1,
  SUNDAY: 2,
  MONDAY: 3,
  TUESDAY: 4,
  WEDNESDAY: 5,
  THURSDAY: 6,
  FRIDAY: 7,
};

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const termName = normalizeUpper(searchParams.get("termName"));
    const batchId = toNumber(searchParams.get("batchId"));
    const teacherId = toNumber(searchParams.get("teacherId"));

    if (!termName || !batchId) {
      return NextResponse.json(
        { error: "termName and batchId are required." },
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

    const batchSlots = await prisma.offered_course_slots.findMany({
      where: {
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
            status: { in: SCHEDULE_CONFLICT_STATUSES },
          },
          offered_course_batches: {
            some: {
              batch_id: batchId,
            },
          },
        },
      },
      include: {
        rooms: true,
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
          },
        },
      },
      orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
    });

    const teacherSlots = teacherId
      ? await prisma.offered_course_slots.findMany({
          where: {
            offered_courses: {
              offerings: {
                academic_term_id: term.id,
                status: { in: SCHEDULE_CONFLICT_STATUSES },
              },
              offered_course_teachers: {
                some: {
                  teacher_id: teacherId,
                },
              },
            },
          },
          include: {
            rooms: true,
            offered_courses: {
              include: {
                master_courses: true,
              },
            },
          },
          orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
        })
      : [];

    const roomSlots = await prisma.offered_course_slots.findMany({
      where: {
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
            status: { in: SCHEDULE_CONFLICT_STATUSES },
          },
        },
      },
      include: {
        rooms: true,
        offered_courses: {
          include: {
            master_courses: true,
          },
        },
      },
      orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
    });

    const occupiedBatchSlots = batchSlots
      .map((slot) => ({
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        roomCode: slot.rooms?.room_code || "-",
        courseCode: slot.offered_courses.master_courses.course_code,
        courseTitle: slot.offered_courses.master_courses.course_title,
        section: slot.offered_courses.section,
        facultyText:
          slot.offered_courses.offered_course_teachers
            .map(
              (row) =>
                `${row.teachers.teacher_code} - ${row.teachers.full_name}`
            )
            .join(", ") || "-",
      }))
      .sort((a, b) => {
        const dayDiff =
          (DAY_ORDER[a.dayOfWeek] ?? 99) - (DAY_ORDER[b.dayOfWeek] ?? 99);
        if (dayDiff !== 0) return dayDiff;
        return a.startTime.localeCompare(b.startTime);
      });

    const teacherOccupiedSlots = teacherSlots.map((slot) => ({
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time,
      endTime: slot.end_time,
      roomCode: slot.rooms?.room_code || "-",
      courseCode: slot.offered_courses.master_courses.course_code,
      courseTitle: slot.offered_courses.master_courses.course_title,
      section: slot.offered_courses.section,
    }));

    const roomOccupiedSlots = roomSlots.map((slot) => ({
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time,
      endTime: slot.end_time,
      roomId: slot.room_id,
      roomCode: slot.rooms?.room_code || "-",
      courseCode: slot.offered_courses.master_courses.course_code,
      courseTitle: slot.offered_courses.master_courses.course_title,
      section: slot.offered_courses.section,
    }));

    const suggestedOpenWindows = Object.keys(DAY_ORDER).map((day) => {
      const daySlots = occupiedBatchSlots.filter((slot) => slot.dayOfWeek === day);
      const busy = daySlots
        .map((slot) => `${slot.startTime}-${slot.endTime}`)
        .join(", ");

      return {
        dayOfWeek: day,
        warning:
          busy.length > 0
            ? `Batch already has classes at: ${busy}`
            : "No batch class found for this day.",
      };
    });

    return NextResponse.json({
      success: true,
      occupiedBatchSlots,
      teacherOccupiedSlots,
      roomOccupiedSlots,
      suggestedOpenWindows,
      message:
        occupiedBatchSlots.length > 0
          ? "Review occupied batch slots before adding a new manual section."
          : "No existing occupied slot found for this batch in this term.",
    });
  } catch (error) {
    console.error("Manual offering availability failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load manual offering availability.",
      },
      { status: 500 }
    );
  }
}
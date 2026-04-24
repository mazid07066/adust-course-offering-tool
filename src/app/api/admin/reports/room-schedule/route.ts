import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const REPORT_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

type RoomScheduleRow = {
  roomCode: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  programCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  facultyText: string;
  batchCodes: string[];
  role: "PRIMARY" | "SECONDARY";
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();
    const roomCodeFilter = String(searchParams.get("roomCode") || "")
      .trim()
      .toUpperCase();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
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

    const courses = await prisma.offered_courses.findMany({
      where: {
        offerings: {
          academic_term_id: term.id,
          status: {
            in: REPORT_VISIBLE_OFFERING_STATUSES,
          },
        },
      },
      include: {
        master_courses: {
          include: {
            program: true,
          },
        },
        offered_course_batches: {
          include: {
            batches: true,
          },
        },
        offered_course_slots: {
          orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
          include: {
            rooms: true,
          },
        },
        offered_course_teachers: {
          include: {
            teachers: true,
          },
        },
        primary_offered_course: {
          include: {
            offered_course_slots: {
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
              include: {
                rooms: true,
              },
            },
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
          },
        },
      },
      orderBy: [{ id: "asc" }],
    });

    const rows: RoomScheduleRow[] = [];

    for (const course of courses) {
      const effectiveSlots =
        course.primary_offered_course?.offered_course_slots.length
          ? course.primary_offered_course.offered_course_slots
          : course.offered_course_slots;

      const effectiveTeachers =
        course.primary_offered_course?.offered_course_teachers.length
          ? course.primary_offered_course.offered_course_teachers
          : course.offered_course_teachers;

      const facultyText =
        effectiveTeachers.length > 0
          ? uniqueStrings(
              effectiveTeachers.map(
                (row) => `${row.teachers.teacher_code} - ${row.teachers.full_name}`
              )
            ).join(", ")
          : "-";

      const batchCodes = uniqueStrings(
        course.offered_course_batches.map((x) => x.batches.batch_code)
      );

      for (const slot of effectiveSlots) {
        const roomCode = slot.rooms?.room_code || "-";

        if (roomCodeFilter && roomCode !== roomCodeFilter) {
          continue;
        }

        rows.push({
          roomCode,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          programCode: course.master_courses.program.short_name,
          courseCode: course.master_courses.course_code,
          courseTitle: course.master_courses.course_title,
          section: course.section,
          facultyText,
          batchCodes,
          role: course.primary_offered_course_id ? "SECONDARY" : "PRIMARY",
        });
      }
    }

    rows.sort((a, b) => {
      if (a.roomCode !== b.roomCode) return a.roomCode.localeCompare(b.roomCode);
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek.localeCompare(b.dayOfWeek);
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      return a.courseCode.localeCompare(b.courseCode);
    });

    const roomOptions = uniqueStrings(rows.map((row) => row.roomCode));

    return NextResponse.json({
      success: true,
      termName: term.name,
      roomOptions,
      summary: {
        totalRows: rows.length,
        totalRooms: roomOptions.length,
      },
      rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load room schedule report." },
      { status: 500 }
    );
  }
}
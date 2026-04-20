import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();
    const roomCodeFilter = String(searchParams.get("roomCode") || "").trim().toUpperCase();

    if (!termName) {
      return NextResponse.json({ error: "termName is required." }, { status: 400 });
    }

    const term = await prisma.academic_terms.findFirst({
      where: { name: termName },
      select: { id: true, name: true },
    });

    if (!term) {
      return NextResponse.json({ error: "Academic term not found." }, { status: 404 });
    }

    const courses = await prisma.offered_courses.findMany({
      where: {
        offerings: {
          academic_term_id: term.id,
          status: "CONFIRMED",
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

    const headers = [
      "Room",
      "Day",
      "Start Time",
      "End Time",
      "Program",
      "Course Code",
      "Course Title",
      "Section",
      "Role",
      "Batches",
      "Faculty",
    ];

    const lines = [headers.map(csvEscape).join(",")];

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

      const batchText = uniqueStrings(
        course.offered_course_batches.map((x) => x.batches.batch_code)
      ).join(", ");

      const role = course.primary_offered_course_id ? "SECONDARY" : "PRIMARY";

      for (const slot of effectiveSlots) {
        const roomCode = slot.rooms?.room_code || "-";

        if (roomCodeFilter && roomCode !== roomCodeFilter) {
          continue;
        }

        lines.push(
          [
            roomCode,
            slot.day_of_week,
            slot.start_time,
            slot.end_time,
            course.master_courses.program.short_name,
            course.master_courses.course_code,
            course.master_courses.course_title,
            course.section,
            role,
            batchText,
            facultyText,
          ]
            .map(csvEscape)
            .join(",")
        );
      }
    }

    const roomFilePart = roomCodeFilter || "ALL_ROOMS";

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="room_schedule_${roomFilePart}_${term.name.replace(/\s+/g, "_")}.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to export room schedule." },
      { status: 500 }
    );
  }
}
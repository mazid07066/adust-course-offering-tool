import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const REPORT_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

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
            master_courses: true,
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
      orderBy: [
        { offerings: { program_id: "asc" } },
        { section: "asc" },
        { id: "asc" },
      ],
    });

    const headers = [
      "Day",
      "Start Time",
      "End Time",
      "Room",
      "Program",
      "Course Code",
      "Course Title",
      "Section",
      "Role",
      "Primary Reference",
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

      const role = course.primary_offered_course_id ? "SECONDARY" : "PRIMARY";
      const primaryReference = course.primary_offered_course_id
        ? `${course.primary_offered_course?.master_courses.course_code || "-"} Sec-${course.primary_offered_course?.section || "-"}`
        : "-";

      const batchText = uniqueStrings(
        course.offered_course_batches.map((x) => x.batches.batch_code)
      ).join(", ");

      if (effectiveSlots.length === 0) {
        lines.push(
          [
            "-",
            "-",
            "-",
            "-",
            course.master_courses.program.short_name,
            course.master_courses.course_code,
            course.master_courses.course_title,
            course.section,
            role,
            primaryReference,
            batchText,
            facultyText,
          ]
            .map(csvEscape)
            .join(",")
        );
        continue;
      }

      for (const slot of effectiveSlots) {
        lines.push(
          [
            slot.day_of_week,
            slot.start_time,
            slot.end_time,
            slot.rooms?.room_code || "-",
            course.master_courses.program.short_name,
            course.master_courses.course_code,
            course.master_courses.course_title,
            course.section,
            role,
            primaryReference,
            batchText,
            facultyText,
          ]
            .map(csvEscape)
            .join(",")
        );
      }
    }

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="confirmed_schedule_${term.name.replace(/\s+/g, "_")}.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to export confirmed schedule." },
      { status: 500 }
    );
  }
}
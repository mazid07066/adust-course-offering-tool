import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function buildScheduleText(
  slots: Array<{
    day_of_week: string;
    start_time: string;
    end_time: string;
    rooms: { room_code: string } | null;
  }>
) {
  if (!slots.length) return "-";

  return slots
    .map(
      (slot) =>
        `${slot.day_of_week} ${slot.start_time}-${slot.end_time} | ${slot.rooms?.room_code || "-"}`
    )
    .join(" ; ");
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

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
          status: "CONFIRMED",
        },
      },
      orderBy: [
        { offerings: { program_id: "asc" } },
        { section: "asc" },
        { id: "asc" },
      ],
      include: {
        offerings: {
          include: {
            programs: true,
          },
        },
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
    });

    const rows = courses.map((course) => {
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
          ? effectiveTeachers
              .map(
                (row) =>
                  `${row.teachers.teacher_code} - ${row.teachers.full_name}`
              )
              .join(", ")
          : "-";

      return {
        offeredCourseId: course.id,
        offeringId: course.offering_id,
        programCode: course.master_courses.program.short_name,
        programName: course.master_courses.program.name,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        section: course.section,
        credit: Number(course.master_courses.credit || 0),
        role: course.primary_offered_course_id ? "SECONDARY" : "PRIMARY",
        primaryReference: course.primary_offered_course_id
          ? `${course.primary_offered_course?.master_courses.course_code || "-"} Sec-${course.primary_offered_course?.section || "-"}`
          : "-",
        batchCodes: course.offered_course_batches.map((x) => x.batches.batch_code),
        facultyText,
        assignedFacultyCount: effectiveTeachers.length,
        scheduleText: buildScheduleText(effectiveSlots),
      };
    });

    const summary = {
      totalRows: rows.length,
      primaryRows: rows.filter((row) => row.role === "PRIMARY").length,
      secondaryRows: rows.filter((row) => row.role === "SECONDARY").length,
      rowsWithFaculty: rows.filter((row) => row.assignedFacultyCount > 0).length,
      rowsWithoutFaculty: rows.filter((row) => row.assignedFacultyCount === 0).length,
    };

    return NextResponse.json({
      success: true,
      termName: term.name,
      summary,
      rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load confirmed offering report." },
      { status: 500 }
    );
  }
}
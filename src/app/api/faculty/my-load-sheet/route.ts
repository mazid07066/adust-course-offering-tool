import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";

export const runtime = "nodejs";

function uniqueByCourseId<T extends { offeredCourseId: number }>(rows: T[]) {
  const seen = new Set<number>();
  const out: T[] = [];

  for (const row of rows) {
    if (seen.has(row.offeredCourseId)) continue;
    seen.add(row.offeredCourseId);
    out.push(row);
  }

  return out;
}

export async function GET(req: NextRequest) {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        { error: "Faculty account is not linked to a faculty record." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "")
      .trim()
      .toUpperCase();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const teacher = await prisma.teachers.findUnique({
      where: { id: guard.teacher_id },
      select: {
        id: true,
        teacher_code: true,
        full_name: true,
        designation: true,
        departments: {
          select: {
            id: true,
            short_name: true,
            name: true,
          },
        },
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "Faculty not found." },
        { status: 404 }
      );
    }

    const term = await prisma.academic_terms.findFirst({
      where: {
        name: termName,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const assignedRows = await prisma.offered_course_teachers.findMany({
      where: {
        teacher_id: teacher.id,
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
          },
        },
      },
      include: {
        offered_courses: {
          include: {
            offerings: true,
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
              include: {
                rooms: true,
              },
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
            },
          },
        },
      },
    });

    const chosenRows = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
        status: "FINAL",
      },
      include: {
        offered_courses: {
          include: {
            offerings: true,
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
              include: {
                rooms: true,
              },
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
            },
          },
        },
      },
    });

    const assignedMapped = assignedRows.map((row) => ({
      source: "ASSIGNED" as const,
      offeredCourseId: row.offered_course_id,
      courseCode: row.offered_courses.master_courses.course_code,
      courseTitle: row.offered_courses.master_courses.course_title,
      credit: Number(row.offered_courses.master_courses.credit || 0),
      section: row.offered_courses.section,
      programCode: row.offered_courses.master_courses.program.short_name,
      programName: row.offered_courses.master_courses.program.name,
      batchCodes: row.offered_courses.offered_course_batches.map(
        (x) => x.batches.batch_code
      ),
      schedule: row.offered_courses.offered_course_slots.map((slot) => ({
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        roomCode: slot.rooms?.room_code || "-",
      })),
    }));

    const chosenMapped = chosenRows.map((row) => ({
      source: "FINALIZED_CHOICE" as const,
      offeredCourseId: row.offered_course_id,
      courseCode: row.offered_courses.master_courses.course_code,
      courseTitle: row.offered_courses.master_courses.course_title,
      credit: Number(row.offered_courses.master_courses.credit || 0),
      section: row.offered_courses.section,
      programCode: row.offered_courses.master_courses.program.short_name,
      programName: row.offered_courses.master_courses.program.name,
      batchCodes: row.offered_courses.offered_course_batches.map(
        (x) => x.batches.batch_code
      ),
      schedule: row.offered_courses.offered_course_slots.map((slot) => ({
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        roomCode: slot.rooms?.room_code || "-",
      })),
    }));

    const combined = uniqueByCourseId([...assignedMapped, ...chosenMapped]);

    const totalCredits = combined.reduce((sum, row) => sum + row.credit, 0);

    return NextResponse.json({
      ok: true,
      termName: term.name,
      faculty: {
        id: teacher.id,
        teacherCode: teacher.teacher_code,
        fullName: teacher.full_name,
        designation: teacher.designation,
        departmentCode: teacher.departments?.short_name || "",
        departmentName: teacher.departments?.name || "",
      },
      totalCredits,
      rows: combined,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load faculty load sheet.",
      },
      { status: 500 }
    );
  }
}
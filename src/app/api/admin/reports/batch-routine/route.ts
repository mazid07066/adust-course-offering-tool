import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

type BatchRoutineRow = {
  batchCode: string;
  programCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  facultyText: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
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
    const batchCodeFilter = String(searchParams.get("batchCode") || "").trim().toUpperCase();

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
        offered_course_batches: batchCodeFilter
          ? {
              some: {
                batches: {
                  batch_code: batchCodeFilter,
                },
              },
            }
          : undefined,
      },
      orderBy: [
        { offerings: { program_id: "asc" } },
        { section: "asc" },
        { id: "asc" },
      ],
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
    });

    const rows: BatchRoutineRow[] = [];

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

      if (effectiveSlots.length === 0) {
        for (const batchCode of batchCodes) {
          rows.push({
            batchCode,
            programCode: course.master_courses.program.short_name,
            courseCode: course.master_courses.course_code,
            courseTitle: course.master_courses.course_title,
            section: course.section,
            facultyText,
            dayOfWeek: "-",
            startTime: "-",
            endTime: "-",
            roomCode: "-",
            role: course.primary_offered_course_id ? "SECONDARY" : "PRIMARY",
          });
        }
        continue;
      }

      for (const batchCode of batchCodes) {
        for (const slot of effectiveSlots) {
          rows.push({
            batchCode,
            programCode: course.master_courses.program.short_name,
            courseCode: course.master_courses.course_code,
            courseTitle: course.master_courses.course_title,
            section: course.section,
            facultyText,
            dayOfWeek: slot.day_of_week,
            startTime: slot.start_time,
            endTime: slot.end_time,
            roomCode: slot.rooms?.room_code || "-",
            role: course.primary_offered_course_id ? "SECONDARY" : "PRIMARY",
          });
        }
      }
    }

    rows.sort((a, b) => {
      if (a.batchCode !== b.batchCode) return a.batchCode.localeCompare(b.batchCode);
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek.localeCompare(b.dayOfWeek);
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      return a.courseCode.localeCompare(b.courseCode);
    });

    const batchOptions = uniqueStrings(rows.map((row) => row.batchCode));

    return NextResponse.json({
      success: true,
      termName: term.name,
      batchOptions,
      summary: {
        totalRows: rows.length,
        totalBatches: batchOptions.length,
      },
      rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load batch routine report." },
      { status: 500 }
    );
  }
}
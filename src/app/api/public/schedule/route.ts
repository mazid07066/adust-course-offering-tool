import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();
    const programCode = String(searchParams.get("programCode") || "").trim().toUpperCase();
    const batchCode = String(searchParams.get("batchCode") || "").trim().toUpperCase();
    const dayOfWeek = String(searchParams.get("dayOfWeek") || "").trim().toUpperCase();

    if (!termName) {
      const confirmedTerms = await prisma.offerings.findMany({
        where: {
          status: "CONFIRMED",
        },
        select: {
          academic_terms: {
            select: {
              name: true,
            },
          },
        },
        distinct: ["academic_term_id"],
      });

      return NextResponse.json({
        success: true,
        terms: uniqueStrings(confirmedTerms.map((x) => x.academic_terms.name)).sort(),
      });
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
        master_courses: programCode
          ? {
              program: {
                short_name: programCode,
              },
            }
          : undefined,
        offered_course_batches: batchCode
          ? {
              some: {
                batches: {
                  batch_code: batchCode,
                },
              },
            }
          : undefined,
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
          include: {
            rooms: true,
          },
          orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
        },
        offered_course_teachers: {
          include: {
            teachers: true,
          },
        },
        primary_offered_course: {
          include: {
            offered_course_slots: {
              include: {
                rooms: true,
              },
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
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

    const rows: Array<{
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      roomCode: string;
      programCode: string;
      courseCode: string;
      courseTitle: string;
      section: string;
      facultyText: string;
      batchCodes: string[];
    }> = [];

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
                (x) => `${x.teachers.teacher_code} - ${x.teachers.full_name}`
              )
            ).join(", ")
          : "-";

      const batchCodes = uniqueStrings(
        course.offered_course_batches.map((x) => x.batches.batch_code)
      );

      for (const slot of effectiveSlots) {
        if (dayOfWeek && slot.day_of_week.toUpperCase() !== dayOfWeek) continue;

        rows.push({
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          roomCode: slot.rooms?.room_code || "-",
          programCode: course.master_courses.program.short_name,
          courseCode: course.master_courses.course_code,
          courseTitle: course.master_courses.course_title,
          section: course.section,
          facultyText,
          batchCodes,
        });
      }
    }

    rows.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek.localeCompare(b.dayOfWeek);
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.programCode !== b.programCode) return a.programCode.localeCompare(b.programCode);
      return a.courseCode.localeCompare(b.courseCode);
    });

    return NextResponse.json({
      success: true,
      termName: term.name,
      filters: {
        programs: uniqueStrings(rows.map((x) => x.programCode)).sort(),
        batches: uniqueStrings(rows.flatMap((x) => x.batchCodes)).sort(),
        days: uniqueStrings(rows.map((x) => x.dayOfWeek)).sort(),
      },
      rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load public schedule." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeSeason(season: string) {
  const s = season.trim().toLowerCase();
  if (s === "spring") return "SPRING";
  if (s === "summer") return "SUMMER";
  if (s === "fall") return "FALL";
  throw new Error("Season must be spring, summer, or fall");
}

export async function GET(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(request.url);

    const season = String(searchParams.get("season") || "").trim();
    const year = String(searchParams.get("year") || "").trim();

    if (!season || !year) {
      return NextResponse.json(
        { error: "season and year are required" },
        { status: 400 }
      );
    }

    const semesterTitle = `${normalizeSeason(season)} ${year}`;

    const term = await prisma.academic_terms.findFirst({
      where: {
        name: semesterTitle,
      },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found" },
        { status: 404 }
      );
    }

    const offerings = await prisma.offerings.findMany({
      where: {
        academic_term_id: term.id,
      },
      include: {
        programs: true,
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_slots: {
              include: {
                rooms: true,
              },
            },
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
            offered_course_batches: {
              include: {
                batches: true,
              },
            },
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });

    const groupedByDay: Record<
      string,
      {
        program: string;
        batchCodes: string[];
        courseCode: string;
        courseTitle: string;
        section: string;
        teachers: string[];
        room: string;
        startTime: string;
        endTime: string;
        slotType: string;
      }[]
    > = {
      SUNDAY: [],
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: [],
    };

    for (const offering of offerings) {
      for (const course of offering.offered_courses) {
        const batchCodes = course.offered_course_batches.map(
          (item) => item.batches.batch_code
        );

        const teachers = course.offered_course_teachers.map(
          (item) => item.teachers.full_name
        );

        for (const slot of course.offered_course_slots) {
          const day = slot.day_of_week.toUpperCase();

          if (!groupedByDay[day]) {
            groupedByDay[day] = [];
          }

          groupedByDay[day].push({
            program: offering.programs.short_name,
            batchCodes,
            courseCode: course.master_courses.course_code,
            courseTitle: course.master_courses.course_title,
            section: course.section,
            teachers,
            room: slot.rooms.room_code,
            startTime: slot.start_time,
            endTime: slot.end_time,
            slotType: slot.slot_type,
          });
        }
      }
    }

    const dayWiseSchedule = Object.entries(groupedByDay).map(([day, items]) => ({
      day,
      items: items.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));

    const flatSchedule = dayWiseSchedule.flatMap((group) =>
      group.items.map((item) => ({
        day: group.day,
        ...item,
      }))
    );

    return NextResponse.json({
      success: true,
      term: {
        id: term.id,
        name: term.name,
        year: term.year,
        termType: term.term_type,
      },
      dayWiseSchedule,
      flatSchedule,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate schedule report",
      },
      { status: 500 }
    );
  }
}
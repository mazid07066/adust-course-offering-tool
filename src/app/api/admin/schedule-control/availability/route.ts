import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { SCHEDULE_CONFLICT_STATUSES } from "@/lib/course-schedule-policy";

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function timeToMinutes(value: string) {
  const [hour, minute] = String(value || "00:00")
    .split(":")
    .map((part) => Number(part));

  return hour * 60 + minute;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return (
    timeToMinutes(aStart) < timeToMinutes(bEnd) &&
    timeToMinutes(aEnd) > timeToMinutes(bStart)
  );
}

async function getSectionGroupCourseIds(offeredCourseId: number) {
  const course = await prisma.offered_courses.findUnique({
    where: {
      id: offeredCourseId,
    },
    select: {
      id: true,
      primary_offered_course_id: true,
    },
  });

  if (!course) return [offeredCourseId];

  const primaryId = course.primary_offered_course_id || course.id;

  const groupCourses = await prisma.offered_courses.findMany({
    where: {
      OR: [{ id: primaryId }, { primary_offered_course_id: primaryId }],
    },
    select: {
      id: true,
    },
  });

  return groupCourses.map((item) => item.id);
}

export async function GET(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(request.url);

    const offeredCourseId = Number(searchParams.get("offeredCourseId") || 0);
    const slotId = Number(searchParams.get("slotId") || 0);
    const dayOfWeek = normalizeText(searchParams.get("dayOfWeek"));
    const startTime = String(searchParams.get("startTime") || "").trim();
    const endTime = String(searchParams.get("endTime") || "").trim();

    if (!offeredCourseId || !dayOfWeek || !startTime || !endTime) {
      return NextResponse.json(
        {
          ok: false,
          error: "offeredCourseId, dayOfWeek, startTime and endTime are required.",
        },
        { status: 400 }
      );
    }

    const selectedCourse = await prisma.offered_courses.findUnique({
      where: {
        id: offeredCourseId,
      },
      select: {
        offerings: {
          select: {
            academic_term_id: true,
          },
        },
      },
    });

    if (!selectedCourse) {
      return NextResponse.json(
        {
          ok: false,
          error: "Offered course not found.",
        },
        { status: 404 }
      );
    }

    const academicTermId = selectedCourse.offerings.academic_term_id;
    const sectionGroupCourseIds = await getSectionGroupCourseIds(offeredCourseId);

    const allRooms = await prisma.rooms.findMany({
      where: {
        is_active: {
          not: false,
        },
      },
      orderBy: [{ room_code: "asc" }],
    });

    const busyRoomSlots = await prisma.offered_course_slots.findMany({
      where: {
        day_of_week: dayOfWeek,
        ...(slotId ? { id: { not: slotId } } : {}),
        offered_course_id: {
          notIn: sectionGroupCourseIds,
        },
        offered_courses: {
          offerings: {
            academic_term_id: academicTermId,
            status: {
              in: SCHEDULE_CONFLICT_STATUSES,
            },
          },
        },
      },
      select: {
        room_id: true,
        start_time: true,
        end_time: true,
      },
    });

    const busyRoomIds = new Set(
      busyRoomSlots
        .filter((slot) => overlaps(startTime, endTime, slot.start_time, slot.end_time))
        .map((slot) => slot.room_id)
    );

    const rooms = allRooms
      .filter((room) => !busyRoomIds.has(room.id))
      .map((room) => ({
        id: room.id,
        roomCode: room.room_code,
        roomType: room.room_type,
        capacity: room.capacity,
      }));

    const courseSlots = await prisma.offered_course_slots.findMany({
      where: {
        offered_course_id: {
          in: sectionGroupCourseIds,
        },
      },
      select: {
        id: true,
        day_of_week: true,
        start_time: true,
        end_time: true,
      },
    });

    const relevantSlots = [
      ...courseSlots.filter((slot) => slot.id !== slotId),
      {
        id: slotId || -1,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
      },
    ];

    const allTeachers = await prisma.teachers.findMany({
      where: {
        is_active: {
          not: false,
        },
      },
      orderBy: [{ teacher_code: "asc" }],
    });

    const otherTeacherAssignments = await prisma.offered_course_teachers.findMany({
      where: {
        offered_course_id: {
          notIn: sectionGroupCourseIds,
        },
        offered_courses: {
          offerings: {
            academic_term_id: academicTermId,
            status: {
              in: SCHEDULE_CONFLICT_STATUSES,
            },
          },
        },
      },
      include: {
        offered_courses: {
          include: {
            offered_course_slots: true,
          },
        },
      },
    });

    const busyTeacherIds = new Set<number>();

    for (const assignment of otherTeacherAssignments) {
      for (const otherSlot of assignment.offered_courses.offered_course_slots) {
        for (const candidateSlot of relevantSlots) {
          if (candidateSlot.day_of_week !== otherSlot.day_of_week) continue;

          if (
            overlaps(
              candidateSlot.start_time,
              candidateSlot.end_time,
              otherSlot.start_time,
              otherSlot.end_time
            )
          ) {
            busyTeacherIds.add(assignment.teacher_id);
          }
        }
      }
    }

    const teachers = allTeachers
      .filter((teacher) => !busyTeacherIds.has(teacher.id))
      .map((teacher) => ({
        id: teacher.id,
        teacherCode: teacher.teacher_code,
        fullName: teacher.full_name,
        designation: teacher.designation || "-",
        email: teacher.email || "-",
        phone: teacher.phone || "-",
        seniorityLevel: teacher.seniority_level,
      }));

    return NextResponse.json({
      ok: true,
      rooms,
      teachers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load availability options.",
      },
      { status: 500 }
    );
  }
}
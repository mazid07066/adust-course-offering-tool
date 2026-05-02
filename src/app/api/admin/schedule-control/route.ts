import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  REPORT_VISIBLE_OFFERING_STATUSES,
  SCHEDULE_CONFLICT_STATUSES,
  isSlotOptionalCourse,
} from "@/lib/course-schedule-policy";

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function scheduleText(slots: any[]) {
  if (!slots.length) return "-";

  return slots
    .map(
      (slot) =>
        `${slot.day_of_week} ${slot.start_time}-${slot.end_time} ${
          slot.rooms?.room_code || "-"
        }`
    )
    .join("; ");
}

export async function GET(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const termName = normalizeText(searchParams.get("termName"));
    const offeringId = Number(searchParams.get("offeringId") || 0);

    if (!termName) {
      const terms = await prisma.offerings.findMany({
        where: {
          status: {
            in: REPORT_VISIBLE_OFFERING_STATUSES,
          },
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
        ok: true,
        terms: unique(terms.map((item) => item.academic_terms.name)),
        offerings: [],
        courses: [],
      });
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
        { ok: false, error: "Academic term not found." },
        { status: 404 }
      );
    }

    const offerings = await prisma.offerings.findMany({
      where: {
        academic_term_id: term.id,
        status: {
          in: SCHEDULE_CONFLICT_STATUSES,
        },
      },
      include: {
        programs: true,
        _count: {
          select: {
            offered_courses: true,
          },
        },
      },
      orderBy: [{ program_id: "asc" }, { id: "asc" }],
    });

    if (!offeringId) {
      return NextResponse.json({
        ok: true,
        termName: term.name,
        terms: [],
        offerings: offerings.map((offering) => ({
          id: offering.id,
          programCode: offering.programs.short_name,
          programName: offering.programs.name,
          status: offering.status,
          courseCount: offering._count.offered_courses,
          canEdit: offering.status !== "CONFIRMED",
          canConfirm: offering.status !== "CONFIRMED",
        })),
        courses: [],
      });
    }

    const offering = await prisma.offerings.findFirst({
      where: {
        id: offeringId,
        academic_term_id: term.id,
      },
      include: {
        programs: true,
      },
    });

    if (!offering) {
      return NextResponse.json(
        { ok: false, error: "Offering not found for selected term." },
        { status: 404 }
      );
    }

    const offeredCourses = await prisma.offered_courses.findMany({
      where: {
        offering_id: offering.id,
      },
      include: {
        master_courses: true,
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

    const courses = offeredCourses.map((course) => {
      const isSecondary = Boolean(course.primary_offered_course_id);
      const effectiveSlots =
        course.primary_offered_course?.offered_course_slots.length
          ? course.primary_offered_course.offered_course_slots
          : course.offered_course_slots;

      const effectiveTeachers =
        course.primary_offered_course?.offered_course_teachers.length
          ? course.primary_offered_course.offered_course_teachers
          : course.offered_course_teachers;

      const batchCodes = unique(
        course.offered_course_batches.map((row) => row.batches.batch_code)
      );

      return {
        offeredCourseId: course.id,
        primaryOfferedCourseId: course.primary_offered_course_id,
        isSecondary,
        editableCourseId: course.primary_offered_course_id || course.id,
        programCode: offering.programs.short_name,
        programName: offering.programs.name,
        offeringStatus: offering.status,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        credit: course.master_courses.credit,
        courseType: course.master_courses.course_type,
        section: course.section,
        batchCodes,
        isSlotOptional: isSlotOptionalCourse({
          course_code: course.master_courses.course_code,
          course_title: course.master_courses.course_title,
          course_type: course.master_courses.course_type,
        }),
        slots: effectiveSlots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          roomId: slot.room_id,
          roomCode: slot.rooms?.room_code || "-",
          roomType: slot.rooms?.room_type || "-",
          slotType: slot.slot_type,
        })),
        teachers: effectiveTeachers.map((row) => ({
          assignmentId: row.id,
          teacherId: row.teacher_id,
          teacherCode: row.teachers.teacher_code,
          fullName: row.teachers.full_name,
          designation: row.teachers.designation || "-",
          assignedCredit: row.assigned_credit,
          loadType: row.load_type,
        })),
        facultyText: effectiveTeachers.length
          ? effectiveTeachers
              .map((row) => `${row.teachers.teacher_code} - ${row.teachers.full_name}`)
              .join(", ")
          : "-",
        scheduleText: scheduleText(effectiveSlots),
      };
    });

    return NextResponse.json({
      ok: true,
      termName: term.name,
      offering: {
        id: offering.id,
        programCode: offering.programs.short_name,
        programName: offering.programs.name,
        status: offering.status,
        canEdit: offering.status !== "CONFIRMED",
        canConfirm: offering.status !== "CONFIRMED",
      },
      offerings: offerings.map((item) => ({
        id: item.id,
        programCode: item.programs.short_name,
        programName: item.programs.name,
        status: item.status,
        courseCount: item._count.offered_courses,
        canEdit: item.status !== "CONFIRMED",
        canConfirm: item.status !== "CONFIRMED",
      })),
      courses,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load schedule control data.",
      },
      { status: 500 }
    );
  }
}
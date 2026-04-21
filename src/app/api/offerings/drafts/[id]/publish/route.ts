import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ALLOWED_SOURCE_STATUSES = [
  "DRAFT",
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
];

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function isSlotOptionalCourse(course: {
  master_courses: {
    course_title?: string | null;
    course_type?: string | null;
  };
}) {
  const title = normalizeText(course.master_courses.course_title);
  const type = normalizeText(course.master_courses.course_type);

  if (
    type.includes("PROJECT") ||
    type.includes("INTERNSHIP") ||
    type.includes("THESIS") ||
    type.includes("VIVA")
  ) {
    return true;
  }

  if (
    title.includes("FINAL YEAR DESIGN PROJECT") ||
    title.includes("FYDP") ||
    title.includes("INTERNSHIP") ||
    title.includes("THESIS") ||
    title.includes("VIVA")
  ) {
    return true;
  }

  return false;
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const offeringId = Number(id);

    if (!offeringId) {
      return NextResponse.json(
        { error: "Invalid offering id." },
        { status: 400 }
      );
    }

    const offering = await prisma.offerings.findFirst({
      where: {
        id: offeringId,
      },
      include: {
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_batches: true,
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
            offered_course_slots: true,
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json(
        { error: "Offering not found." },
        { status: 404 }
      );
    }

    if (!ALLOWED_SOURCE_STATUSES.includes(offering.status)) {
      return NextResponse.json(
        {
          error: `Only ${ALLOWED_SOURCE_STATUSES.join(", ")} offerings can be published.`,
        },
        { status: 400 }
      );
    }

    if (offering.offered_courses.length === 0) {
      return NextResponse.json(
        { error: "Cannot publish an empty offering." },
        { status: 400 }
      );
    }

    const blockers: string[] = [];

    for (const course of offering.offered_courses) {
      const isPrimary = !course.primary_offered_course_id;
      const slotOptional = isSlotOptionalCourse(course);

      if (course.offered_course_batches.length === 0) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no batch assigned.`
        );
      }

      if (!isPrimary) {
        continue;
      }

      if (!slotOptional && course.offered_course_slots.length === 0) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no meeting slot assigned.`
        );
      }

      if (course.offered_course_teachers.length === 0) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no faculty assigned.`
        );
      }

      if (course.offered_course_teachers.length > 1) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: multiple faculty assignments found.`
        );
      }

      const inactiveAssignedTeacher = course.offered_course_teachers.find(
        (row) => !row.teachers.is_active
      );

      if (inactiveAssignedTeacher) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: assigned faculty is inactive.`
        );
      }
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: "Publishing blocked due to assignment/schedule incompleteness.",
          blockers,
        },
        { status: 400 }
      );
    }

    await prisma.offerings.update({
      where: {
        id: offeringId,
      },
      data: {
        status: "CONFIRMED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Offering published successfully with assignment completeness checks passed.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish offering.",
      },
      { status: 500 }
    );
  }
}
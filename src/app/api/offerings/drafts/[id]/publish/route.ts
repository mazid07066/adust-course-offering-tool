import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { OFFERING_STATUS } from "@/lib/offering-status";

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
      where: { id: offeringId },
      include: {
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_batches: true,
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

    if (
      offering.status !== OFFERING_STATUS.DRAFT &&
      offering.status !== OFFERING_STATUS.BUFFER_READY
    ) {
      return NextResponse.json(
        {
          error: "Only DRAFT or BUFFER_READY offerings can be opened for faculty choice.",
        },
        { status: 400 }
      );
    }

    const blockers: string[] = [];

    if (offering.offered_courses.length === 0) {
      blockers.push("Cannot move empty offering to BUFFER_READY.");
    }

    for (const course of offering.offered_courses) {
      const isPrimary = !course.primary_offered_course_id;
      const slotOptional = isSlotOptionalCourse(course);

      if (course.offered_course_batches.length === 0) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no batch assigned.`
        );
      }

      if (!isPrimary) continue;

      if (!slotOptional && course.offered_course_slots.length === 0) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no meeting slot assigned.`
        );
      }
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: "Move to BUFFER_READY blocked.",
          blockers,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.offerings.update({
      where: { id: offeringId },
      data: {
        status: OFFERING_STATUS.BUFFER_READY,
      },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Offering is now BUFFER_READY and ready for later faculty-choice stage.",
      offering: updated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to move offering to BUFFER_READY.",
      },
      { status: 500 }
    );
  }
}
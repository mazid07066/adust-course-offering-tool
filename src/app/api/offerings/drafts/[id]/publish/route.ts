import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await requireCoordinatorOrAdminApi();

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
            offered_course_batches: true,
            offered_course_teachers: true,
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

    if (offering.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT offerings can be published." },
        { status: 400 }
      );
    }

    if (offering.offered_courses.length === 0) {
      return NextResponse.json(
        { error: "Cannot publish an empty offering." },
        { status: 400 }
      );
    }

    for (const course of offering.offered_courses) {
      if (course.offered_course_batches.length === 0) {
        return NextResponse.json(
          { error: `Course ID ${course.id} has no assigned batch.` },
          { status: 400 }
        );
      }

      const isPrimary = !course.primary_offered_course_id;

      if (isPrimary && course.offered_course_teachers.length === 0) {
        return NextResponse.json(
          { error: `Primary course ID ${course.id} has no assigned faculty.` },
          { status: 400 }
        );
      }

      if (isPrimary && course.offered_course_slots.length === 0) {
        return NextResponse.json(
          { error: `Primary course ID ${course.id} has no assigned meeting slot.` },
          { status: 400 }
        );
      }
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
      message: "Draft offering published successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish draft offering.",
      },
      { status: 500 }
    );
  }
}
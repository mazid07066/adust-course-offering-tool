import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function DELETE(
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
      where: { id: offeringId },
      include: {
        offered_courses: true,
      },
    });

    if (!offering) {
      return NextResponse.json(
        { error: "Draft offering not found." },
        { status: 404 }
      );
    }

    if (offering.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT offerings can be deleted." },
        { status: 400 }
      );
    }

    const offeredCourseIds = offering.offered_courses.map((c) => c.id);

    if (offeredCourseIds.length > 0) {
      await prisma.offered_course_slots.deleteMany({
        where: {
          offered_course_id: { in: offeredCourseIds },
        },
      });

      await prisma.offered_course_teachers.deleteMany({
        where: {
          offered_course_id: { in: offeredCourseIds },
        },
      });

      await prisma.offered_course_batches.deleteMany({
        where: {
          offered_course_id: { in: offeredCourseIds },
        },
      });

      await prisma.offered_courses.deleteMany({
        where: {
          id: { in: offeredCourseIds },
        },
      });
    }

    await prisma.offerings.delete({
      where: {
        id: offeringId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Draft offering deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete draft offering.",
      },
      { status: 500 }
    );
  }
}
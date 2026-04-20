import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { canDelete } from "@/lib/offering-status";

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
        offered_courses: {
          select: {
            id: true,
            primary_offered_course_id: true,
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json(
        { error: "Draft offering not found." },
        { status: 404 }
      );
    }

    if (!canDelete(offering.status)) {
      return NextResponse.json(
        { error: "Only deletable offerings can be deleted." },
        { status: 400 }
      );
    }

    const secondaryIds = offering.offered_courses
      .filter((c) => Boolean(c.primary_offered_course_id))
      .map((c) => c.id);

    const primaryIds = offering.offered_courses
      .filter((c) => !c.primary_offered_course_id)
      .map((c) => c.id);

    const deleteOrder = [...secondaryIds, ...primaryIds];

    if (deleteOrder.length > 0) {
      await prisma.faculty_course_selections.deleteMany({
        where: {
          offered_course_id: { in: deleteOrder },
        },
      });

      await prisma.offered_course_slots.deleteMany({
        where: {
          offered_course_id: { in: deleteOrder },
        },
      });

      await prisma.offered_course_teachers.deleteMany({
        where: {
          offered_course_id: { in: deleteOrder },
        },
      });

      await prisma.offered_course_batches.deleteMany({
        where: {
          offered_course_id: { in: deleteOrder },
        },
      });

      if (secondaryIds.length > 0) {
        await prisma.offered_courses.deleteMany({
          where: {
            id: { in: secondaryIds },
          },
        });
      }

      if (primaryIds.length > 0) {
        await prisma.offered_courses.deleteMany({
          where: {
            id: { in: primaryIds },
          },
        });
      }
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
          error instanceof Error
            ? error.message
            : "Failed to delete draft offering.",
      },
      { status: 500 }
    );
  }
}
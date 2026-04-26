import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const offeringId = Number(id);

    if (!Number.isFinite(offeringId) || offeringId <= 0) {
      return NextResponse.json(
        { error: "Valid offering id is required." },
        { status: 400 }
      );
    }

    const offering = await prisma.offerings.findUnique({
      where: {
        id: offeringId,
      },
      select: {
        id: true,
        status: true,
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
        {
          error:
            "Only DRAFT offerings can be deleted. Move or reset the offering status before deleting.",
        },
        { status: 400 }
      );
    }

    const offeredCourses = await prisma.offered_courses.findMany({
      where: {
        offering_id: offeringId,
      },
      select: {
        id: true,
      },
    });

    const offeredCourseIds = offeredCourses.map((course) => course.id);

    await prisma.$transaction(async (tx) => {
      if (offeredCourseIds.length > 0) {
        await tx.faculty_course_selections.deleteMany({
          where: {
            offered_course_id: {
              in: offeredCourseIds,
            },
          },
        });

        await tx.offered_course_manual_cooffers.deleteMany({
          where: {
            offered_course_id: {
              in: offeredCourseIds,
            },
          },
        });

        await tx.offered_course_teachers.deleteMany({
          where: {
            offered_course_id: {
              in: offeredCourseIds,
            },
          },
        });

        await tx.offered_course_slots.deleteMany({
          where: {
            offered_course_id: {
              in: offeredCourseIds,
            },
          },
        });

        await tx.offered_course_batches.deleteMany({
          where: {
            offered_course_id: {
              in: offeredCourseIds,
            },
          },
        });

        await tx.offered_courses.deleteMany({
          where: {
            id: {
              in: offeredCourseIds,
            },
          },
        });
      }

      await tx.offerings.delete({
        where: {
          id: offeringId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Offering deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete offering.",
      },
      { status: 500 }
    );
  }
}
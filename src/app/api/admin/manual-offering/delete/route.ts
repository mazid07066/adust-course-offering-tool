import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function DELETE(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const offeredCourseId = toNumber(searchParams.get("offeredCourseId"));

    if (!offeredCourseId) {
      return NextResponse.json(
        { error: "offeredCourseId is required." },
        { status: 400 }
      );
    }

    const offeredCourse = await prisma.offered_courses.findUnique({
      where: { id: offeredCourseId },
      include: {
        offerings: true,
      },
    });

    if (!offeredCourse) {
      return NextResponse.json(
        { error: "Offered course not found." },
        { status: 404 }
      );
    }

    if (offeredCourse.offerings.status === "CONFIRMED") {
      return NextResponse.json(
        { error: "Cannot delete a course from a confirmed offering." },
        { status: 400 }
      );
    }

    if (offeredCourse.notes !== "MANUAL_ADDITION") {
      return NextResponse.json(
        {
          error:
            "Only manual additions can be deleted from this correction tool.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.offered_course_slots.deleteMany({
        where: { offered_course_id: offeredCourseId },
      });

      await tx.offered_course_teachers.deleteMany({
        where: { offered_course_id: offeredCourseId },
      });

      await tx.offered_course_batches.deleteMany({
        where: { offered_course_id: offeredCourseId },
      });

      await tx.offered_courses.delete({
        where: { id: offeredCourseId },
      });
    });

    clearReportingCacheWithLog("manual offered course deleted");

    return NextResponse.json({
      success: true,
      message: "Manual offered course deleted successfully.",
    });
  } catch (error) {
    console.error("Manual offering delete failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete manual offered course.",
      },
      { status: 500 }
    );
  }
}
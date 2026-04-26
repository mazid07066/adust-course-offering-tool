import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { deleteOfferedCourseCascade } from "@/lib/offering-section-group";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ offeredCourseId: string }> }
) {
  try {
    await requireCoordinatorOrAdminApi();

    const params = await context.params;
    const offeredCourseId = Number(params.offeredCourseId);

    if (!Number.isFinite(offeredCourseId) || offeredCourseId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Valid offeredCourseId is required.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.offered_courses.findUnique({
      where: {
        id: offeredCourseId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Draft course not found.",
        },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await deleteOfferedCourseCascade(tx, offeredCourseId);
    });

    return NextResponse.json({
      ok: true,
      message: "Draft course deleted successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete draft course.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const body = await req.json();
    const secondaryOfferedCourseId = Number(body.secondaryOfferedCourseId);

    if (!Number.isFinite(secondaryOfferedCourseId) || secondaryOfferedCourseId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid secondaryOfferedCourseId is required." },
        { status: 400 }
      );
    }

    const secondary = await prisma.offered_courses.findUnique({
      where: {
        id: secondaryOfferedCourseId,
      },
      select: {
        id: true,
        primary_offered_course_id: true,
      },
    });

    if (!secondary) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Secondary section not found." },
        { status: 404 }
      );
    }

    if (!secondary.primary_offered_course_id) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "This section is not currently linked under a primary section." },
        { status: 400 }
      );
    }

    const primaryId = secondary.primary_offered_course_id;

    await prisma.$transaction(async (tx) => {
      await tx.offered_courses.update({
        where: {
          id: secondary.id,
        },
        data: {
          primary_offered_course_id: null,
          is_cooffered: false,
        },
      });

      const remainingChildren = await tx.offered_courses.count({
        where: {
          primary_offered_course_id: primaryId,
        },
      });

      if (remainingChildren === 0) {
        await tx.offered_courses.update({
          where: {
            id: primaryId,
          },
          data: {
            is_cooffered: false,
          },
        });
      }
    });

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      ok: true,
      message: "Co-offering link removed successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove co-offering link.";

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
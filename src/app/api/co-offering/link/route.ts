import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const body = await req.json();

    const primaryOfferedCourseId = Number(body.primaryOfferedCourseId);
    const secondaryOfferedCourseId = Number(body.secondaryOfferedCourseId);

    if (!Number.isFinite(primaryOfferedCourseId) || primaryOfferedCourseId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid primaryOfferedCourseId is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(secondaryOfferedCourseId) || secondaryOfferedCourseId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid secondaryOfferedCourseId is required." },
        { status: 400 }
      );
    }

    if (primaryOfferedCourseId === secondaryOfferedCourseId) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "A section cannot be linked to itself." },
        { status: 400 }
      );
    }

    const primary = await prisma.offered_courses.findUnique({
      where: { id: primaryOfferedCourseId },
      include: {
        offerings: {
          include: {
            academic_terms: true,
          },
        },
        master_courses: {
          include: {
            program: true,
          },
        },
      },
    });

    const secondary = await prisma.offered_courses.findUnique({
      where: { id: secondaryOfferedCourseId },
      include: {
        offerings: {
          include: {
            academic_terms: true,
          },
        },
        master_courses: {
          include: {
            program: true,
          },
        },
      },
    });

    if (!primary) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Primary section not found." },
        { status: 404 }
      );
    }

    if (!secondary) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Secondary section not found." },
        { status: 404 }
      );
    }

    if (primary.offerings.status !== "DRAFT" || secondary.offerings.status !== "DRAFT") {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Both sections must belong to DRAFT offerings." },
        { status: 400 }
      );
    }

    if (primary.offerings.academic_term_id !== secondary.offerings.academic_term_id) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Primary and secondary sections must be in the same academic term." },
        { status: 400 }
      );
    }

    if (primary.primary_offered_course_id) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "The selected primary section is already a linked secondary section." },
        { status: 400 }
      );
    }

    if (secondary.primary_offered_course_id) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "The selected secondary section is already linked under another primary." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.offered_courses.update({
        where: {
          id: secondary.id,
        },
        data: {
          primary_offered_course_id: primary.id,
          is_cooffered: true,
        },
      });

      await tx.offered_courses.update({
        where: {
          id: primary.id,
        },
        data: {
          is_cooffered: true,
        },
      });
    });

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      ok: true,
      message: "Co-offering link created successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create co-offering link.";

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
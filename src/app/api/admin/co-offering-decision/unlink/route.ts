import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { offeredCourseId } = await req.json();

    if (!offeredCourseId) {
      return NextResponse.json(
        { ok: false, error: "offeredCourseId required" },
        { status: 400 }
      );
    }

    const course = await prisma.offered_courses.findUnique({
      where: { id: offeredCourseId },
      include: {
        primary_offered_course: true,
        secondary_offered_courses: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { ok: false, error: "Course not found" },
        { status: 404 }
      );
    }

    // CASE 1: This is SECONDARY → unlink from primary
    if (course.primary_offered_course_id) {
      await prisma.offered_courses.update({
        where: { id: course.id },
        data: {
          primary_offered_course_id: null,
          is_cooffered: false,
        },
      });

      clearReportingCacheWithLog("co-offering unlinked (secondary)");

      return NextResponse.json({
        ok: true,
        message: "Secondary course unlinked successfully",
      });
    }

    // CASE 2: This is PRIMARY → unlink ALL secondaries
    if (course.secondary_offered_courses.length > 0) {
      await prisma.offered_courses.updateMany({
        where: {
          primary_offered_course_id: course.id,
        },
        data: {
          primary_offered_course_id: null,
          is_cooffered: false,
        },
      });

      await prisma.offered_courses.update({
        where: { id: course.id },
        data: { is_cooffered: false },
      });

      clearReportingCacheWithLog("co-offering unlinked (primary)");

      return NextResponse.json({
        ok: true,
        message: "Primary and all linked courses reset",
      });
    }

    return NextResponse.json({
      ok: false,
      error: "Course is not co-offered",
    });

  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Unlink failed" },
      { status: 500 }
    );
  }
}
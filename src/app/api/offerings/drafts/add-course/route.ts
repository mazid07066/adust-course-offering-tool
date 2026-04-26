import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const body = await req.json();

    const draftId = Number(body.draftId);
    const courseId = Number(body.courseId);
    const section = String(body.section || "").trim();
    const batchIds = Array.isArray(body.batchIds)
      ? body.batchIds.map((x: unknown) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0)
      : [];

    if (!Number.isFinite(draftId) || draftId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid draftId is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(courseId) || courseId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid courseId is required." },
        { status: 400 }
      );
    }

    if (!section) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "section is required." },
        { status: 400 }
      );
    }

    if (batchIds.length === 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "At least one batchId is required." },
        { status: 400 }
      );
    }

    const existingRows = await prisma.offered_courses.findMany({
      where: {
        offering_id: draftId,
        master_course_id: courseId,
        offered_course_batches: {
          some: {
            batch_id: {
              in: batchIds,
            },
          },
        },
      },
      select: {
        id: true,
        section: true,
        offered_course_batches: {
          select: {
            batch_id: true,
            batches: {
              select: {
                batch_code: true,
              },
            },
          },
        },
      },
    });

    if (existingRows.length > 0) {
      const batchCodes = [
        ...new Set(
          existingRows.flatMap((row) =>
            row.offered_course_batches
              .filter((b) => batchIds.includes(b.batch_id))
              .map((b) => b.batches.batch_code)
          )
        ),
      ];

      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error:
            `This course is already assigned in the current draft for batch ${batchCodes.join(", ")}. ` +
            `A course can be assigned only once per batch in the same draft.`,
        },
        { status: 400 }
      );
    }

    const duplicateSection = await prisma.offered_courses.findFirst({
      where: {
        offering_id: draftId,
        master_course_id: courseId,
        section,
      },
      select: {
        id: true,
      },
    });

    if (duplicateSection) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "This course-section already exists in the current draft.",
        },
        { status: 400 }
      );
    }

    const offered = await prisma.offered_courses.create({
      data: {
        offering_id: draftId,
        master_course_id: courseId,
        section,
        primary_offered_course_id: null,
        is_cooffered: false,
      },
      select: {
        id: true,
      },
    });

    await prisma.offered_course_batches.createMany({
      data: batchIds.map((batchId: number) => ({
        offered_course_id: offered.id,
        batch_id: batchId,
      })),
    });

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      ok: true,
      offeredCourseId: offered.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add course to draft.";

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
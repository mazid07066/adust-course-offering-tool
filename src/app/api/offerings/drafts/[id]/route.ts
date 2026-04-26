import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DELETABLE_STATUSES = new Set([
  "DRAFT",
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
]);

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const params = await context.params;
    const offeringId = Number(params.id);

    if (!offeringId || Number.isNaN(offeringId)) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid offering id is required." },
        { status: 400 }
      );
    }

    const offering = await prisma.offerings.findUnique({
      where: {
        id: offeringId,
      },
      include: {
        academic_terms: true,
        programs: true,
      },
    });

    if (!offering) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Draft offering not found." },
        { status: 404 }
      );
    }

    const status = String(offering.status || "").trim().toUpperCase();

    if (!DELETABLE_STATUSES.has(status)) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: `Offering with status ${offering.status} cannot be deleted from this draft cleanup action.`,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const offeredCourses = await tx.offered_courses.findMany({
        where: {
          offering_id: offeringId,
        },
        select: {
          id: true,
        },
      });

      const offeredCourseIds = offeredCourses.map((course) => course.id);

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

        await tx.offered_course_slots.deleteMany({
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

        await tx.offered_course_batches.deleteMany({
          where: {
            offered_course_id: {
              in: offeredCourseIds,
            },
          },
        });

        await tx.offered_courses.updateMany({
          where: {
            primary_offered_course_id: {
              in: offeredCourseIds,
            },
          },
          data: {
            primary_offered_course_id: null,
            is_cooffered: false,
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

      return {
        deletedOfferingId: offeringId,
        deletedCourseCount: offeredCourseIds.length,
        termName: offering.academic_terms.name,
        programCode: offering.programs.short_name,
      };
    });

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      ok: true,
      message: "Draft offering deleted successfully.",
      result,
    });
  } catch (error) {
    console.error("Delete draft offering error:", error);

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete draft offering.",
      },
      { status: 500 }
    );
  }
}
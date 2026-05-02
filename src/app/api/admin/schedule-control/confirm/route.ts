import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";
import { isSlotOptionalCourse } from "@/lib/course-schedule-policy";
import { scanScheduleConflicts } from "@/lib/schedule-conflict-scanner";

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();
    const offeringId = Number(body.offeringId);

    if (!offeringId) {
      return NextResponse.json(
        { ok: false, error: "Valid offeringId is required." },
        { status: 400 }
      );
    }

    const offering = await prisma.offerings.findUnique({
      where: {
        id: offeringId,
      },
      include: {
        programs: true,
        academic_terms: true,
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_batches: true,
            offered_course_slots: true,
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json(
        { ok: false, error: "Offering not found." },
        { status: 404 }
      );
    }

    if (offering.status === "CONFIRMED") {
      return NextResponse.json({
        ok: true,
        message: "Offering is already CONFIRMED.",
      });
    }

    const blockers: string[] = [];

    for (const course of offering.offered_courses) {
      const isPrimary = !course.primary_offered_course_id;

      if (course.offered_course_batches.length === 0) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no batch assigned.`
        );
      }

      if (!isPrimary) continue;

      const optional = isSlotOptionalCourse({
        course_code: course.master_courses.course_code,
        course_title: course.master_courses.course_title,
        course_type: course.master_courses.course_type,
      });

      if (!optional && course.offered_course_slots.length === 0) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no slot assigned.`
        );
      }

      if (course.offered_course_teachers.length === 0) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no faculty assigned.`
        );
      }

      if (course.offered_course_teachers.length > 1) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: multiple faculty assignments found.`
        );
      }

      const inactive = course.offered_course_teachers.find(
        (row) => row.teachers.is_active === false
      );

      if (inactive) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: assigned faculty is inactive.`
        );
      }
    }

    const conflictResult = await scanScheduleConflicts({
      termId: offering.academic_term_id,
      offeringId: offering.id,
    });

    if (conflictResult.ok && conflictResult.conflicts.length > 0) {
      blockers.push(
        `${conflictResult.summary.total} conflict(s) found. Resolve all conflicts before confirmation.`
      );
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Offering confirmation blocked.",
          blockers,
          conflicts: conflictResult.ok ? conflictResult.conflicts : [],
          summary: conflictResult.ok ? conflictResult.summary : null,
        },
        { status: 400 }
      );
    }

    await prisma.offerings.update({
      where: {
        id: offering.id,
      },
      data: {
        status: "CONFIRMED",
      },
    });

    clearReportingCacheWithLog("schedule-control confirmed offering");

    return NextResponse.json({
      ok: true,
      message: `${offering.programs.short_name} ${offering.academic_terms.name} confirmed successfully.`,
      reportUrl: `/admin/reports?termName=${encodeURIComponent(offering.academic_terms.name)}&programCode=${encodeURIComponent(offering.programs.short_name)}`,
      publicScheduleUrl: `/schedule`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to confirm offering.",
      },
      { status: 500 }
    );
  }
}
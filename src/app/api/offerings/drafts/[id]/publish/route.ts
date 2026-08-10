import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { OFFERING_STATUS } from "@/lib/offering-status";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeText(
  value: unknown
) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isSlotOptionalCourse(course: {
  master_courses: {
    course_title?: string | null;
    course_type?: string | null;
  };
}) {
  const title =
    normalizeText(
      course.master_courses
        .course_title
    );

  const type =
    normalizeText(
      course.master_courses
        .course_type
    );

  return (
    type.includes("PROJECT") ||
    type.includes("INTERNSHIP") ||
    type.includes("THESIS") ||
    type.includes("VIVA") ||
    title.includes(
      "FINAL YEAR DESIGN PROJECT"
    ) ||
    title.includes("FYDP") ||
    title.includes("INTERNSHIP") ||
    title.includes("THESIS") ||
    title.includes("VIVA")
  );
}

export async function POST(
  _req: NextRequest,
  context: RouteContext
) {
  const guard =
    await requireCoordinatorOrAdminApi();

  if (
    guard instanceof Response
  ) {
    return guard;
  }

  try {
    const params =
      await context.params;

    const offeringId =
      Number(params.id);

    if (
      !offeringId ||
      Number.isNaN(
        offeringId
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Valid offering id is required.",
        },
        {
          status: 400,
        }
      );
    }

    const offering =
      await prisma.offerings
        .findUnique({
          where: {
            id: offeringId,
          },

          include: {
            academic_terms:
              true,

            programs:
              true,

            offered_courses: {
              include: {
                master_courses:
                  true,

                offered_course_batches:
                  true,

                offered_course_slots:
                  true,
              },
            },
          },
        });

    if (!offering) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Offering not found.",
        },
        {
          status: 404,
        }
      );
    }

    const currentStatus =
      normalizeText(
        offering.status
      );

    if (
      currentStatus ===
      OFFERING_STATUS.BUFFER_READY
    ) {
      return NextResponse.json({
        ok: true,

        message:
          "Offering is already finalized and ready for faculty choice.",

        offering: {
          id: offering.id,

          status:
            offering.status,

          termName:
            offering
              .academic_terms
              .name,

          programCode:
            offering
              .programs
              .short_name,
        },
      });
    }

    if (
      currentStatus !==
      OFFERING_STATUS.DRAFT
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            `Only DRAFT offerings can be finalized. Current status: ${offering.status}`,
        },
        {
          status: 400,
        }
      );
    }

    const blockers:
      string[] = [];

    if (
      !Boolean(
        offering
          .academic_terms
          .is_current
      )
    ) {
      blockers.push(
        `Only the current academic term can be finalized. ${offering.academic_terms.name} is not the current term.`
      );
    }

    if (
      offering
        .offered_courses
        .length === 0
    ) {
      blockers.push(
        "Cannot finalize an empty offering."
      );
    }

    for (
      const course of
      offering.offered_courses
    ) {
      const isPrimary =
        !course
          .primary_offered_course_id;

      const slotOptional =
        isSlotOptionalCourse(
          course
        );

      if (
        course
          .offered_course_batches
          .length === 0
      ) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no batch assigned.`
        );
      }

      if (
        isPrimary &&
        !slotOptional &&
        course
          .offered_course_slots
          .length === 0
      ) {
        blockers.push(
          `${course.master_courses.course_code} Sec-${course.section}: no meeting slot assigned.`
        );
      }
    }

    if (
      blockers.length > 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "Offering is not ready to be finalized.",

          blockers,
        },
        {
          status: 400,
        }
      );
    }

    const updated =
      await prisma.offerings
        .update({
          where: {
            id: offeringId,
          },

          data: {
            status:
              OFFERING_STATUS.BUFFER_READY,
          },

          select: {
            id: true,
            status: true,

            academic_terms: {
              select: {
                name: true,
              },
            },

            programs: {
              select: {
                short_name:
                  true,
              },
            },
          },
        });

    clearReportingCacheWithLog(
      "offering/reporting data changed"
    );

    return NextResponse.json({
      ok: true,

      message:
        "Draft finalized successfully. Offering is now BUFFER_READY and may be opened for faculty choice.",

      offering: {
        id:
          updated.id,

        status:
          updated.status,

        termName:
          updated
            .academic_terms
            .name,

        programCode:
          updated
            .programs
            .short_name,
      },
    });
  } catch (error) {
    console.error(
      "Finalize draft offering error:",
      error
    );

    clearReportingCacheWithLog(
      "offering/reporting data changed"
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize offering.",
      },
      {
        status: 500,
      }
    );
  }
}
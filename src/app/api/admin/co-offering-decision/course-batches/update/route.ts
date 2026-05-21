import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";
import { SCHEDULE_CONFLICT_STATUSES } from "@/lib/course-schedule-policy";

function toMinutes(value: string) {
  const [h, m] = String(value || "00:00")
    .split(":")
    .map((part) => Number(part));

  return h * 60 + m;
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  return (
    toMinutes(aStart) < toMinutes(bEnd) &&
    toMinutes(aEnd) > toMinutes(bStart)
  );
}

async function getCoofferingGroupCourseIds(
  offeredCourseId: number
) {
  const course = await prisma.offered_courses.findUnique({
    where: {
      id: offeredCourseId,
    },

    select: {
      id: true,
      primary_offered_course_id: true,
    },
  });

  if (!course) {
    return [offeredCourseId];
  }

  const primaryId =
    course.primary_offered_course_id || course.id;

  const rows = await prisma.offered_courses.findMany({
    where: {
      OR: [
        { id: primaryId },
        { primary_offered_course_id: primaryId },
      ],
    },

    select: {
      id: true,
    },
  });

  return rows.map((row) => row.id);
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const body = await req.json();

    const offeredCourseId = Number(
      body.offeredCourseId
    );

    const batchIds = Array.isArray(body.batchIds)
      ? body.batchIds
          .map((item: unknown) => Number(item))
          .filter(
            (item: number) =>
              Number.isFinite(item) && item > 0
          )
      : [];

    if (
      !Number.isFinite(offeredCourseId) ||
      offeredCourseId <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Valid offeredCourseId is required.",
        },
        { status: 400 }
      );
    }

    if (batchIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Select at least one batch.",
        },
        { status: 400 }
      );
    }

    const course =
      await prisma.offered_courses.findUnique({
        where: {
          id: offeredCourseId,
        },

        include: {
          offerings: {
            include: {
              programs: true,
              academic_terms: true,
            },
          },

          master_courses: true,

          offered_course_slots: true,

          primary_offered_course: {
            include: {
              offered_course_slots: true,
            },
          },
        },
      });

    if (!course) {
      return NextResponse.json(
        {
          ok: false,
          error: "Offered course not found.",
        },
        { status: 404 }
      );
    }

    if (course.offerings.status === "CONFIRMED") {
      return NextResponse.json(
        {
          ok: false,

          error:
            "This offering is CONFIRMED. Reset it to editable before changing batches.",
        },
        { status: 400 }
      );
    }

    const attachedLinks =
      await prisma.offered_course_batches.findMany({
        where: {
          offered_course_id: course.id,
        },

        select: {
          batch_id: true,
        },
      });

    const offeringLinks =
      await prisma.offered_course_batches.findMany({
        where: {
          offered_courses: {
            offering_id: course.offering_id,
          },
        },

        select: {
          batch_id: true,
        },
      });

    const allowedIds = new Set<number>([
      ...attachedLinks.map((row) => row.batch_id),
      ...offeringLinks.map((row) => row.batch_id),
    ]);

    const programBatches =
      await prisma.batches.findMany({
        where: {
          program_id: course.offerings.program_id,
        },

        select: {
          id: true,
        },
      });

    for (const item of programBatches) {
      allowedIds.add(item.id);
    }

    const invalidIds = batchIds.filter(
      (id: number) => !allowedIds.has(id)
    );

    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "Some selected batches are not available under this program/offering workflow: " +
            invalidIds.join(", "),
        },
        { status: 400 }
      );
    }

    const targetBatches =
      await prisma.batches.findMany({
        where: {
          id: {
            in: batchIds,
          },
        },

        include: {
          programs: true,
        },
      });

    const effectiveSlots =
      course.primary_offered_course
        ?.offered_course_slots.length
        ? course.primary_offered_course
            .offered_course_slots
        : course.offered_course_slots;

    const coofferingGroupIds =
      await getCoofferingGroupCourseIds(
        course.id
      );

    for (const batch of targetBatches) {
      for (const slot of effectiveSlots) {
        const conflictingSlots =
          await prisma.offered_course_slots.findMany({
            where: {
              day_of_week: slot.day_of_week,

              offered_course_id: {
                notIn: coofferingGroupIds,
              },

              offered_courses: {
                offerings: {
                  academic_term_id:
                    course.offerings.academic_term_id,

                  status: {
                    in: SCHEDULE_CONFLICT_STATUSES,
                  },
                },

                offered_course_batches: {
                  some: {
                    batch_id: batch.id,
                  },
                },
              },
            },

            include: {
              offered_courses: {
                include: {
                  master_courses: true,

                  offerings: {
                    include: {
                      programs: true,
                    },
                  },
                },
              },
            },
          });

        const conflict = conflictingSlots.find(
          (item) =>
            overlaps(
              slot.start_time,
              slot.end_time,
              item.start_time,
              item.end_time
            )
        );

        if (conflict) {
          return NextResponse.json(
            {
              ok: false,

              error:
                `Batch ${batch.batch_code} has a schedule conflict with ` +
                `${conflict.offered_courses.offerings.programs.short_name} ` +
                `${conflict.offered_courses.master_courses.course_code} Sec-${conflict.offered_courses.section} ` +
                `on ${conflict.day_of_week} ${conflict.start_time}-${conflict.end_time}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.offered_course_batches.deleteMany({
        where: {
          offered_course_id: course.id,
        },
      });

      await tx.offered_course_batches.createMany({
        data: targetBatches.map((batch) => ({
          offered_course_id: course.id,
          batch_id: batch.id,
        })),
      });
    });

    clearReportingCacheWithLog(
      "co-offering decision course batches updated"
    );

    return NextResponse.json({
      ok: true,

      message:
        `${course.offerings.programs.short_name} ${course.master_courses.course_code} Sec-${course.section} ` +
        `batch list updated successfully.`,
    });
  } catch (error) {
    clearReportingCacheWithLog(
      "co-offering decision course batch update failed"
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to update course batches.",
      },
      { status: 500 }
    );
  }
}
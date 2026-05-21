import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
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

async function getCoofferingGroupCourseIds(offeredCourseId: number) {
  const course = await prisma.offered_courses.findUnique({
    where: { id: offeredCourseId },
    select: {
      id: true,
      primary_offered_course_id: true,
    },
  });

  if (!course) {
    return [offeredCourseId];
  }

  const primaryId = course.primary_offered_course_id || course.id;

  const rows = await prisma.offered_courses.findMany({
    where: {
      OR: [{ id: primaryId }, { primary_offered_course_id: primaryId }],
    },
    select: { id: true },
  });

  return rows.map((row) => row.id);
}

function uniqueById<T extends { id: number }>(rows: T[]) {
  const map = new Map<number, T>();

  for (const row of rows) {
    map.set(row.id, row);
  }

  return Array.from(map.values()).sort((a: any, b: any) =>
    String(a.batch_code || "").localeCompare(String(b.batch_code || ""))
  );
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const { searchParams } = new URL(req.url);

    const offeredCourseId = Number(
      searchParams.get("offeredCourseId")
    );

    if (!Number.isFinite(offeredCourseId) || offeredCourseId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Valid offeredCourseId is required.",
        },
        { status: 400 }
      );
    }

    const course = await prisma.offered_courses.findUnique({
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

        offered_course_batches: {
          include: {
            batches: {
              include: {
                programs: true,
              },
            },
          },
        },

        offered_course_slots: true,

        primary_offered_course: {
          include: {
            master_courses: true,

            offered_course_slots: true,

            offerings: {
              include: {
                programs: true,
              },
            },
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

    const effectiveSlots =
      course.primary_offered_course?.offered_course_slots.length
        ? course.primary_offered_course.offered_course_slots
        : course.offered_course_slots;

    const groupIds = await getCoofferingGroupCourseIds(course.id);

    const attachedBatchIds =
      course.offered_course_batches.map((row) => row.batch_id);

    const offeringBatchLinks =
      await prisma.offered_course_batches.findMany({
        where: {
          offered_courses: {
            offering_id: course.offering_id,
          },
        },

        include: {
          batches: {
            include: {
              programs: true,
            },
          },
        },
      });

    const offeringBatchIds = offeringBatchLinks.map(
      (row) => row.batch_id
    );

    const programBatches = await prisma.batches.findMany({
      where: {
        program_id: course.offerings.program_id,
      },

      include: {
        programs: true,
      },
    });

    const attachedBatches = await prisma.batches.findMany({
      where: {
        id: {
          in: attachedBatchIds.length
            ? attachedBatchIds
            : [-1],
        },
      },

      include: {
        programs: true,
      },
    });

    const offeringBatches = await prisma.batches.findMany({
      where: {
        id: {
          in: offeringBatchIds.length
            ? offeringBatchIds
            : [-1],
        },
      },

      include: {
        programs: true,
      },
    });

    const allBatches = uniqueById([
      ...programBatches,
      ...attachedBatches,
      ...offeringBatches,
    ]);

    const availableBatches = [];

    for (const batch of allBatches) {
      let hasConflict = false;
      let conflictReason = "";

      for (const slot of effectiveSlots) {
        const possibleConflicts =
          await prisma.offered_course_slots.findMany({
            where: {
              day_of_week: slot.day_of_week,

              offered_course_id: {
                notIn: groupIds,
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

        const conflict = possibleConflicts.find((item) =>
          overlaps(
            slot.start_time,
            slot.end_time,
            item.start_time,
            item.end_time
          )
        );

        if (conflict) {
          hasConflict = true;

          conflictReason =
            `${conflict.day_of_week} ${conflict.start_time}-${conflict.end_time} with ` +
            `${conflict.offered_courses.offerings.programs.short_name} ` +
            `${conflict.offered_courses.master_courses.course_code} Sec-${conflict.offered_courses.section}`;

          break;
        }
      }

      const isProgramMismatch =
        batch.program_id !== course.offerings.program_id;

      const isUsedInThisOffering =
        offeringBatchIds.includes(batch.id);

      const isAttached =
        attachedBatchIds.includes(batch.id);

      availableBatches.push({
        id: batch.id,

        batchCode: batch.batch_code,

        programCode: batch.programs.short_name,

        isAttached,

        isUsedInThisOffering,

        hasConflict,

        conflictReason,

        isInactive: batch.is_active === false,

        isProgramMismatch,

        warning: isProgramMismatch
          ? `This batch belongs to ${batch.programs.short_name}, but it is available because it is already used/attached in this offering workflow.`
          : "",
      });
    }

    return NextResponse.json({
      ok: true,

      course: {
        id: course.id,

        offeringId: course.offering_id,

        programCode:
          course.offerings.programs.short_name,

        programName:
          course.offerings.programs.name,

        termName:
          course.offerings.academic_terms.name,

        offeringStatus:
          course.offerings.status,

        courseCode:
          course.master_courses.course_code,

        courseTitle:
          course.master_courses.course_title,

        section: course.section,

        isSecondary:
          Boolean(course.primary_offered_course_id),

        primaryLabel:
          course.primary_offered_course
            ? `${course.primary_offered_course.offerings.programs.short_name} | ${course.primary_offered_course.master_courses.course_code} Sec-${course.primary_offered_course.section}`
            : "",
      },

      attachedBatchIds,

      attachedBatchCodes:
        course.offered_course_batches.map(
          (row) => row.batches.batch_code
        ),

      availableBatches,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to load batch options.",
      },
      { status: 500 }
    );
  }
}
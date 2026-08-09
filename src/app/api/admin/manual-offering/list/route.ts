import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  requireCoordinatorOrAdminApi,
} from "@/lib/auth-guard";

import {
  getCatalogProgramByCode,
} from "@/lib/academic-catalog";

import {
  resolveCanonicalProgram,
} from "@/lib/canonical-program";

function normalizeUpper(
  value: unknown
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}

async function getProgramCandidateIds(
  programCode: string
) {
  const normalizedProgramCode =
    normalizeUpper(
      programCode
    );

  if (
    !normalizedProgramCode
  ) {
    return [];
  }

  const staticCatalog =
    getCatalogProgramByCode(
      normalizedProgramCode
    );

  if (!staticCatalog) {
    return [];
  }

  const catalogEntry =
    await prisma
      .academic_catalog_entries
      .findUnique({
        where: {
          program_code:
            normalizedProgramCode,
        },

        select: {
          curriculum_key:
            true,

          department_code:
            true,

          department_name:
            true,

          program_title:
            true,

          study_shift:
            true,
        },
      });

  const ids =
    new Set<number>();

  const exactProgram =
    await prisma
      .programs
      .findFirst({
        where: {
          short_name:
            normalizedProgramCode,
        },

        select: {
          id: true,
        },
      });

  if (exactProgram) {
    ids.add(
      exactProgram.id
    );
  }

  const canonicalProgram =
    await resolveCanonicalProgram({
      department_code:
        catalogEntry
          ?.department_code ||
        staticCatalog
          .departmentCode,

      department_name:
        catalogEntry
          ?.department_name ||
        staticCatalog
          .departmentName,

      program_code:
        normalizedProgramCode,

      program_title:
        catalogEntry
          ?.program_title ||
        staticCatalog
          .programTitle,

      study_shift:
        catalogEntry
          ?.study_shift ||
        staticCatalog
          .studyShift,
    });

  ids.add(
    canonicalProgram.id
  );

  const curriculumKey =
    catalogEntry
      ?.curriculum_key ||
    null;

  if (curriculumKey) {
    const relatedCatalogEntries =
      await prisma
        .academic_catalog_entries
        .findMany({
          where: {
            curriculum_key:
              curriculumKey,

            is_active:
              true,
          },

          select: {
            program_code:
              true,
          },
        });

    const relatedProgramCodes =
      relatedCatalogEntries
        .map(
          (item) =>
            normalizeUpper(
              item.program_code
            )
        )
        .filter(Boolean);

    if (
      relatedProgramCodes.length >
      0
    ) {
      const relatedPrograms =
        await prisma
          .programs
          .findMany({
            where: {
              short_name: {
                in:
                  relatedProgramCodes,
              },
            },

            select: {
              id: true,
            },
          });

      for (
        const program of
        relatedPrograms
      ) {
        ids.add(
          program.id
        );
      }
    }
  }

  return Array.from(
    ids
  );
}

export async function GET(
  req: NextRequest
) {
  const guard =
    await requireCoordinatorOrAdminApi();

  if (
    guard instanceof Response
  ) {
    return guard;
  }

  try {
    const {
      searchParams,
    } =
      new URL(req.url);

    const termName =
      normalizeUpper(
        searchParams.get(
          "termName"
        )
      );

    const programCode =
      normalizeUpper(
        searchParams.get(
          "programCode"
        )
      );

    if (!termName) {
      return NextResponse.json(
        {
          error:
            "termName is required.",
        },
        {
          status: 400,
        }
      );
    }

    const term =
      await prisma
        .academic_terms
        .findFirst({
          where: {
            name:
              termName,
          },

          select: {
            id: true,
            name: true,
          },
        });

    if (!term) {
      return NextResponse.json(
        {
          error:
            "Academic term not found.",
        },
        {
          status: 404,
        }
      );
    }

    const candidateProgramIds =
      programCode
        ? await getProgramCandidateIds(
            programCode
          )
        : [];

    const rows =
      await prisma
        .offered_courses
        .findMany({
          where: {
            offerings: {
              academic_term_id:
                term.id,

              ...(programCode &&
              candidateProgramIds.length >
                0
                ? {
                    program_id:
                      {
                        in:
                          candidateProgramIds,
                      },
                  }
                : {}),
            },
          },

          orderBy: [
            {
              offering_id:
                "asc",
            },

            {
              id:
                "asc",
            },
          ],

          include: {
            offerings: {
              include: {
                programs:
                  true,
              },
            },

            master_courses:
              true,

            offered_course_batches:
              {
                include: {
                  batches:
                    true,
                },
              },

            offered_course_slots:
              {
                include: {
                  rooms:
                    true,
                },

                orderBy: [
                  {
                    day_of_week:
                      "asc",
                  },

                  {
                    start_time:
                      "asc",
                  },
                ],
              },

            offered_course_teachers:
              {
                include: {
                  teachers:
                    true,
                },
              },
          },
        });

    return NextResponse.json({
      success: true,

      rows:
        rows.map(
          (row) => ({
            offeredCourseId:
              row.id,

            offeringId:
              row.offering_id,

            offeringStatus:
              row.offerings
                .status,

            programCode:
              row.offerings
                .programs
                .short_name,

            isManualAddition:
              row.notes ===
              "MANUAL_ADDITION",

            masterCourseId:
              row.master_course_id,

            courseCode:
              row.master_courses
                .course_code,

            courseTitle:
              row.master_courses
                .course_title,

            section:
              row.section,

            credit:
              Number(
                row.master_courses
                  .credit ||
                  0
              ),

            batchIds:
              row.offered_course_batches
                .map(
                  (item) =>
                    item.batch_id
                ),

            batchCodes:
              row.offered_course_batches
                .map(
                  (item) =>
                    item.batches
                      .batch_code
                ),

            teacherId:
              row.offered_course_teachers
                [0]
                ?.teacher_id ??
              null,

            loadType:
              row.offered_course_teachers
                [0]
                ?.load_type ||
              "MANUAL",

            facultyText:
              row.offered_course_teachers
                .map(
                  (item) =>
                    `${item.teachers.teacher_code} - ${item.teachers.full_name}`
                )
                .join(", ") ||
              "-",

            slots:
              row.offered_course_slots
                .map(
                  (slot) => ({
                    id:
                      slot.id,

                    dayOfWeek:
                      slot.day_of_week,

                    startTime:
                      slot.start_time,

                    endTime:
                      slot.end_time,

                    roomId:
                      slot.room_id,

                    roomCode:
                      slot.rooms
                        ?.room_code ||
                      "-",

                    slotType:
                      slot.slot_type,
                  })
                ),

            scheduleText:
              row.offered_course_slots
                .map(
                  (slot) =>
                    `${slot.day_of_week} ${slot.start_time}-${slot.end_time} | ${
                      slot.rooms
                        ?.room_code ||
                      "-"
                    }`
                )
                .join(" ; ") ||
              "-",
          })
        ),
    });
  } catch (error) {
    console.error(
      "Manual offering list failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load offered courses.",
      },
      {
        status: 500,
      }
    );
  }
}
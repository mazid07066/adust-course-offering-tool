import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function resolveProgramIdsFromAcademicIdentity(programCode: string) {
  const directPrograms = await prisma.programs.findMany({
    where: {
      short_name: programCode,
    },
    select: {
      id: true,
    },
  });

  const directIds = directPrograms.map((item) => item.id);

  const catalog = await prisma.academic_catalog_entries.findFirst({
    where: {
      program_code: programCode,
    },
    select: {
      curriculum_key: true,
    },
  });

  if (!catalog?.curriculum_key) {
    return uniqueStrings(directIds.map(String)).map(Number);
  }

  const curriculumPrograms = await prisma.master_courses.findMany({
    where: {
      curriculum_key: catalog.curriculum_key,
    },
    select: {
      program_id: true,
    },
    distinct: ["program_id"],
  });

  const mergedIds = [
    ...directIds,
    ...curriculumPrograms.map((item) => item.program_id),
  ];

  return uniqueStrings(mergedIds.map(String)).map(Number);
}

function mapDraftSection(item: any) {
  const slots = (item.offered_course_slots || []).map((slot: any) => ({
    id: slot.id,
    dayOfWeek: slot.day_of_week,
    startTime: slot.start_time,
    endTime: slot.end_time,
    slotType: slot.slot_type || "CLASS",
    roomId: slot.room_id,
    roomCode: slot.rooms?.room_code || "-",
    roomType: slot.rooms?.room_type || "-",
  }));

  const faculty = (item.offered_course_teachers || []).map(
    (assignment: any) => ({
      id: assignment.teachers?.id || assignment.teacher_id,
      teacherCode: assignment.teachers?.teacher_code || "-",
      fullName: assignment.teachers?.full_name || "-",
      assignedCredit: Number(assignment.assigned_credit || 0),
      loadType: assignment.load_type || "-",
    })
  );

  return {
    id: item.id,
    offeringId: item.offering_id,
    section: item.section,

    programCode:
      item.master_courses?.program?.short_name || "-",

    programName:
      item.master_courses?.program?.name || "-",

    courseCode:
      item.master_courses?.course_code || "-",

    courseTitle:
      item.master_courses?.course_title || "-",

    credit: Number(item.master_courses?.credit || 0),

    batchCodes: uniqueStrings(
      (item.offered_course_batches || []).map(
        (row: any) => row.batches?.batch_code || ""
      )
    ),

    slots,

    faculty,

    scheduleText:
      slots.length > 0
        ? slots
            .map(
              (slot: any) =>
                `${slot.dayOfWeek} ${slot.startTime}-${slot.endTime} | ${slot.roomCode}`
            )
            .join(" ; ")
        : "-",

    facultyText:
      faculty.length > 0
        ? uniqueStrings(
            faculty.map(
              (teacher: any) =>
                `${teacher.teacherCode} - ${teacher.fullName}`
            )
          ).join(", ")
        : "-",

    slotCount: slots.length,

    teacherCount: faculty.length,

    manualCoofferedCodes:
      (item.offered_course_manual_cooffers || []).map(
        (row: any) => ({
          id: row.id,
          coofferedCourseCode: row.cooffered_course_code,
          note: row.note || "",
        })
      ),

    isSecondary:
      item.primary_offered_course_id != null,

    primaryOfferedCourseId:
      item.primary_offered_course_id ?? null,
  };
}

const sectionInclude = {
  master_courses: {
    include: {
      program: true,
    },
  },

  offered_course_batches: {
    include: {
      batches: true,
    },
  },

  offered_course_slots: {
    orderBy: [
      {
        day_of_week: "asc" as const,
      },
      {
        start_time: "asc" as const,
      },
    ],

    include: {
      rooms: true,
    },
  },

  offered_course_teachers: {
    include: {
      teachers: true,
    },
  },

  offered_course_manual_cooffers: {
    orderBy: [
      {
        id: "asc" as const,
      },
    ],
  },
};

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const { searchParams } = new URL(req.url);

    const termName = normalizeText(
      searchParams.get("termName")
    );

    const primaryProgramCode = normalizeText(
      searchParams.get("primaryProgramCode")
    );

    const secondaryProgramCode = normalizeText(
      searchParams.get("secondaryProgramCode")
    );

    if (
      !termName ||
      !primaryProgramCode ||
      !secondaryProgramCode
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "termName, primaryProgramCode, and secondaryProgramCode are required.",
        },
        {
          status: 400,
        }
      );
    }

    const [
      primaryProgramIds,
      secondaryProgramIds,
    ] = await Promise.all([
      resolveProgramIdsFromAcademicIdentity(
        primaryProgramCode
      ),
      resolveProgramIdsFromAcademicIdentity(
        secondaryProgramCode
      ),
    ]);

    if (primaryProgramIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Primary academic identity not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (secondaryProgramIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Secondary academic identity not found.",
        },
        {
          status: 404,
        }
      );
    }

    const [
      primarySectionsRaw,
      secondarySectionsRaw,
      linkedRowsRaw,
    ] = await Promise.all([
      prisma.offered_courses.findMany({
        where: {
          primary_offered_course_id: null,

          offerings: {
            status: "DRAFT",

            academic_terms: {
              name: termName,
            },
          },

          master_courses: {
            program_id: {
              in: primaryProgramIds,
            },
          },
        },

        orderBy: [
          {
            section: "asc",
          },
          {
            id: "asc",
          },
        ],

        include: sectionInclude,
      }),

      prisma.offered_courses.findMany({
        where: {
          offerings: {
            status: "DRAFT",

            academic_terms: {
              name: termName,
            },
          },

          master_courses: {
            program_id: {
              in: secondaryProgramIds,
            },
          },
        },

        orderBy: [
          {
            section: "asc",
          },
          {
            id: "asc",
          },
        ],

        include: sectionInclude,
      }),

      prisma.offered_courses.findMany({
        where: {
          primary_offered_course_id: {
            not: null,
          },

          offerings: {
            status: "DRAFT",

            academic_terms: {
              name: termName,
            },
          },

          OR: [
            {
              master_courses: {
                program_id: {
                  in: secondaryProgramIds,
                },
              },
            },

            {
              primary_offered_course: {
                master_courses: {
                  program_id: {
                    in: primaryProgramIds,
                  },
                },
              },
            },
          ],
        },

        orderBy: [
          {
            id: "asc",
          },
        ],

        include: {
          master_courses: {
            include: {
              program: true,
            },
          },

          offered_course_batches: {
            include: {
              batches: true,
            },
          },

          primary_offered_course: {
            include: {
              master_courses: {
                include: {
                  program: true,
                },
              },

              offered_course_batches: {
                include: {
                  batches: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const primarySections =
      primarySectionsRaw.map(mapDraftSection);

    const secondarySections =
      secondarySectionsRaw.map(mapDraftSection);

    const linkedCoofferingSections =
      linkedRowsRaw.map((row) => ({
        secondaryId:
          row.id,

        secondaryProgramCode:
          row.master_courses?.program?.short_name ||
          "-",

        secondaryProgramName:
          row.master_courses?.program?.name ||
          "-",

        secondaryCourseCode:
          row.master_courses?.course_code ||
          "-",

        secondaryCourseTitle:
          row.master_courses?.course_title ||
          "-",

        secondarySection:
          row.section,

        secondaryBatchCodes:
          uniqueStrings(
            (
              row.offered_course_batches || []
            ).map(
              (batchRow: any) =>
                batchRow.batches?.batch_code ||
                ""
            )
          ),

        primaryId:
          row.primary_offered_course?.id ||
          null,

        primaryProgramCode:
          row.primary_offered_course
            ?.master_courses?.program
            ?.short_name || "-",

        primaryProgramName:
          row.primary_offered_course
            ?.master_courses?.program?.name ||
          "-",

        primaryCourseCode:
          row.primary_offered_course
            ?.master_courses?.course_code ||
          "-",

        primaryCourseTitle:
          row.primary_offered_course
            ?.master_courses?.course_title ||
          "-",

        primarySection:
          row.primary_offered_course?.section ||
          "-",

        primaryBatchCodes:
          uniqueStrings(
            (
              row.primary_offered_course
                ?.offered_course_batches || []
            ).map(
              (batchRow: any) =>
                batchRow.batches?.batch_code ||
                ""
            )
          ),
      }));

    return NextResponse.json({
      ok: true,
      primarySections,
      secondarySections,
      linkedCoofferingSections,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load co-offering options.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}

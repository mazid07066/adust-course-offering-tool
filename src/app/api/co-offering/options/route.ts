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

  const directIds = directPrograms.map((x) => x.id);

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
    ...curriculumPrograms.map((x) => x.program_id),
  ];

  return uniqueStrings(mergedIds.map(String)).map(Number);
}

function mapDraftSection(item: any) {
  return {
    id: item.id,
    offeringId: item.offering_id,
    section: item.section,
    programCode: item.master_courses?.program?.short_name || "-",
    programName: item.master_courses?.program?.name || "-",
    courseCode: item.master_courses?.course_code || "-",
    courseTitle: item.master_courses?.course_title || "-",
    credit: Number(item.master_courses?.credit || 0),
    batchCodes: uniqueStrings(
      (item.offered_course_batches || []).map((x: any) => x.batches?.batch_code || "")
    ),
    slotCount: (item.offered_course_slots || []).length,
    teacherCount: (item.offered_course_teachers || []).length,
    manualCoofferedCodes: (item.offered_course_manual_cooffers || []).map((x: any) => ({
      id: x.id,
      coofferedCourseCode: x.cooffered_course_code,
      note: x.note || "",
    })),
    isSecondary: item.primary_offered_course_id != null,
    primaryOfferedCourseId: item.primary_offered_course_id ?? null,
  };
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const termName = normalizeText(searchParams.get("termName"));
    const primaryProgramCode = normalizeText(searchParams.get("primaryProgramCode"));
    const secondaryProgramCode = normalizeText(searchParams.get("secondaryProgramCode"));

    if (!termName || !primaryProgramCode || !secondaryProgramCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "termName, primaryProgramCode, and secondaryProgramCode are required.",
        },
        { status: 400 }
      );
    }

    const [primaryProgramIds, secondaryProgramIds] = await Promise.all([
      resolveProgramIdsFromAcademicIdentity(primaryProgramCode),
      resolveProgramIdsFromAcademicIdentity(secondaryProgramCode),
    ]);

    if (primaryProgramIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Primary academic identity not found." },
        { status: 404 }
      );
    }

    if (secondaryProgramIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Secondary academic identity not found." },
        { status: 404 }
      );
    }

    const [primarySectionsRaw, secondarySectionsRaw, linkedRowsRaw] = await Promise.all([
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
        orderBy: [{ section: "asc" }, { id: "asc" }],
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
          offered_course_slots: {
            select: { id: true },
          },
          offered_course_teachers: {
            select: { id: true },
          },
          offered_course_manual_cooffers: {
            orderBy: [{ id: "asc" }],
          },
        },
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
        orderBy: [{ section: "asc" }, { id: "asc" }],
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
          offered_course_slots: {
            select: { id: true },
          },
          offered_course_teachers: {
            select: { id: true },
          },
          offered_course_manual_cooffers: {
            orderBy: [{ id: "asc" }],
          },
        },
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
        orderBy: [{ id: "asc" }],
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

    const primarySections = primarySectionsRaw.map(mapDraftSection);

    const secondarySections = secondarySectionsRaw.map(mapDraftSection);

    const linkedCoofferingSections = linkedRowsRaw.map((row) => ({
      secondaryId: row.id,
      secondaryProgramCode: row.master_courses?.program?.short_name || "-",
      secondaryProgramName: row.master_courses?.program?.name || "-",
      secondaryCourseCode: row.master_courses?.course_code || "-",
      secondaryCourseTitle: row.master_courses?.course_title || "-",
      secondarySection: row.section,
      secondaryBatchCodes: uniqueStrings(
        (row.offered_course_batches || []).map((x: any) => x.batches?.batch_code || "")
      ),
      primaryId: row.primary_offered_course?.id || null,
      primaryProgramCode:
        row.primary_offered_course?.master_courses?.program?.short_name || "-",
      primaryProgramName:
        row.primary_offered_course?.master_courses?.program?.name || "-",
      primaryCourseCode: row.primary_offered_course?.master_courses?.course_code || "-",
      primaryCourseTitle:
        row.primary_offered_course?.master_courses?.course_title || "-",
      primarySection: row.primary_offered_course?.section || "-",
      primaryBatchCodes: uniqueStrings(
        (row.primary_offered_course?.offered_course_batches || []).map(
          (x: any) => x.batches?.batch_code || ""
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
      error instanceof Error ? error.message : "Failed to load co-offering options.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
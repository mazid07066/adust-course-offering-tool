import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function GET(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

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

    const primaryPrograms = await prisma.programs.findMany({
      where: { short_name: primaryProgramCode },
      select: { id: true },
    });

    const secondaryPrograms = await prisma.programs.findMany({
      where: { short_name: secondaryProgramCode },
      select: { id: true },
    });

    const primaryProgramIds = new Set(primaryPrograms.map((x) => x.id));
    const secondaryProgramIds = new Set(secondaryPrograms.map((x) => x.id));

    if (primaryProgramIds.size === 0) {
      return NextResponse.json(
        { ok: false, error: "Primary academic identity not found." },
        { status: 404 }
      );
    }

    if (secondaryProgramIds.size === 0) {
      return NextResponse.json(
        { ok: false, error: "Secondary academic identity not found." },
        { status: 404 }
      );
    }

    const primarySectionsRaw = await prisma.offered_courses.findMany({
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
            in: [...primaryProgramIds],
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
    });

    const secondarySectionsRaw = await prisma.offered_courses.findMany({
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
            in: [...secondaryProgramIds],
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
      },
    });

    const linkedSections = await prisma.offered_courses.findMany({
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
    });

    const primarySections = primarySectionsRaw.map((row) => {
      const batchCodes = uniqueStrings(
        row.offered_course_batches.map((x) => x.batches.batch_code)
      );

      return {
        id: row.id,
        label: `${row.master_courses.course_code} | Sec-${row.section} | ${row.master_courses.program.short_name}`,
        courseCode: row.master_courses.course_code,
        courseTitle: row.master_courses.course_title,
        section: row.section,
        programCode: row.master_courses.program.short_name,
        batchCodes,
        hasOwnSlots: row.offered_course_slots.length > 0,
        hasOwnTeachers: row.offered_course_teachers.length > 0,
        manualCooffers: row.offered_course_manual_cooffers.map((item) => ({
          id: item.id,
          target_program_code: item.target_program_code,
          manual_course_code: item.manual_course_code,
          note: item.note,
        })),
      };
    });

    const primarySectionBySection = new Set(primarySections.map((x) => x.section));

    const secondarySections = secondarySectionsRaw.map((row) => {
      const batchCodes = uniqueStrings(
        row.offered_course_batches.map((x) => x.batches.batch_code)
      );

      return {
        id: row.id,
        label: `${row.master_courses.course_code} | Sec-${row.section} | ${row.master_courses.program.short_name}`,
        courseCode: row.master_courses.course_code,
        courseTitle: row.master_courses.course_title,
        section: row.section,
        programCode: row.master_courses.program.short_name,
        batchCodes,
        recommended: primarySectionBySection.has(row.section),
      };
    });

    const existingLinks = linkedSections
      .filter((secondary) => {
        const primary = secondary.primary_offered_course;
        if (!primary) return false;

        const primaryProgramMatch = primaryProgramIds.has(primary.master_courses.program_id);
        const secondaryProgramMatch = secondaryProgramIds.has(secondary.master_courses.program_id);

        return primaryProgramMatch && secondaryProgramMatch;
      })
      .map((secondary) => ({
        primaryOfferedCourseId: secondary.primary_offered_course!.id,
        primaryLabel: `${secondary.primary_offered_course!.master_courses.course_code} | Sec-${secondary.primary_offered_course!.section} | ${secondary.primary_offered_course!.master_courses.program.short_name}`,
        secondaryOfferedCourseId: secondary.id,
        secondaryLabel: `${secondary.master_courses.course_code} | Sec-${secondary.section} | ${secondary.master_courses.program.short_name}`,
        primaryBatchCodes: secondary.primary_offered_course!.offered_course_batches.map(
          (x) => x.batches.batch_code
        ),
        secondaryBatchCodes: secondary.offered_course_batches.map(
          (x) => x.batches.batch_code
        ),
      }));

    return NextResponse.json({
      ok: true,
      termName,
      primarySections,
      secondarySections: [
        ...secondarySections.filter((x) => x.recommended),
        ...secondarySections.filter((x) => !x.recommended),
      ],
      existingLinks,
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
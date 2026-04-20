import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source:
    | "EXACT_PROGRAM_CODE"
    | "CANONICAL_PROGRAM"
    | "CURRICULUM_RELATED_PROGRAM";
};

type SectionOption = {
  id: number;
  label: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  programCode: string;
  batchCodes: string[];
};

function uniqueById<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

async function getProgramCandidates(programCode: string): Promise<ProgramCandidate[]> {
  const normalizedProgramCode = String(programCode || "").trim().toUpperCase();

  if (!normalizedProgramCode) {
    throw new Error("programCode is required.");
  }

  const staticCatalog = getCatalogProgramByCode(normalizedProgramCode);
  if (!staticCatalog) {
    throw new Error("Invalid academic identity programCode.");
  }

  const catalogEntry = await prisma.academic_catalog_entries.findUnique({
    where: {
      program_code: normalizedProgramCode,
    },
    select: {
      curriculum_key: true,
      department_code: true,
      department_name: true,
      program_title: true,
      study_shift: true,
    },
  });

  const candidates: ProgramCandidate[] = [];

  const exactProgram = await prisma.programs.findFirst({
    where: {
      short_name: normalizedProgramCode,
    },
    select: {
      id: true,
      short_name: true,
      name: true,
    },
  });

  if (exactProgram) {
    candidates.push({
      ...exactProgram,
      source: "EXACT_PROGRAM_CODE",
    });
  }

  const canonicalProgram = await resolveCanonicalProgram({
    department_code: catalogEntry?.department_code || staticCatalog.departmentCode,
    department_name: catalogEntry?.department_name || staticCatalog.departmentName,
    program_code: normalizedProgramCode,
    program_title: catalogEntry?.program_title || staticCatalog.programTitle,
    study_shift: catalogEntry?.study_shift || staticCatalog.studyShift,
  });

  if (!candidates.some((item) => item.id === canonicalProgram.id)) {
    candidates.push({
      id: canonicalProgram.id,
      short_name: canonicalProgram.short_name,
      name: canonicalProgram.name,
      source: "CANONICAL_PROGRAM",
    });
  }

  const curriculumKey = catalogEntry?.curriculum_key || null;

  if (curriculumKey) {
    const relatedCatalogEntries = await prisma.academic_catalog_entries.findMany({
      where: {
        curriculum_key: curriculumKey,
        is_active: true,
      },
      select: {
        program_code: true,
      },
    });

    const relatedProgramCodes = relatedCatalogEntries
      .map((item) => item.program_code)
      .filter(Boolean);

    if (relatedProgramCodes.length > 0) {
      const relatedPrograms = await prisma.programs.findMany({
        where: {
          short_name: {
            in: relatedProgramCodes,
          },
        },
        select: {
          id: true,
          short_name: true,
          name: true,
        },
      });

      for (const item of relatedPrograms) {
        if (!candidates.some((row) => row.id === item.id)) {
          candidates.push({
            ...item,
            source: "CURRICULUM_RELATED_PROGRAM",
          });
        }
      }
    }
  }

  return uniqueById(candidates);
}

function toSectionOption(course: {
  id: number;
  section: string;
  master_courses: {
    course_code: string;
    course_title: string;
    program: {
      short_name: string;
      name: string;
    };
  };
  offered_course_batches: Array<{
    batches: {
      batch_code: string;
    };
  }>;
}): SectionOption {
  const batchCodes = course.offered_course_batches.map((x) => x.batches.batch_code);

  return {
    id: course.id,
    label: `${course.master_courses.course_code} | Sec-${course.section} | ${course.master_courses.program.short_name} | Batches: ${batchCodes.join(", ") || "-"}`,
    courseCode: course.master_courses.course_code,
    courseTitle: course.master_courses.course_title,
    section: course.section,
    programCode: course.master_courses.program.short_name,
    batchCodes,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();
    const primaryProgramCode = String(searchParams.get("primaryProgramCode") || "").trim();
    const secondaryProgramCode = String(searchParams.get("secondaryProgramCode") || "").trim();

    if (!termName) {
      return NextResponse.json(
        { ok: false, error: "termName is required." },
        { status: 400 }
      );
    }

    if (!primaryProgramCode) {
      return NextResponse.json(
        { ok: false, error: "primaryProgramCode is required." },
        { status: 400 }
      );
    }

    const primaryCandidates = await getProgramCandidates(primaryProgramCode);
    const secondaryCandidates = secondaryProgramCode
      ? await getProgramCandidates(secondaryProgramCode)
      : [];

    const primaryProgramIds = new Set(primaryCandidates.map((x) => x.id));
    const secondaryProgramIds = new Set(secondaryCandidates.map((x) => x.id));

    const allDraftSections = await prisma.offered_courses.findMany({
      where: {
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
          },
        },
      },
    });

    const primarySections = allDraftSections
      .filter(
        (course) =>
          !course.primary_offered_course_id &&
          primaryProgramIds.has(course.master_courses.program_id)
      )
      .map(toSectionOption);

    const secondarySections = allDraftSections
      .filter(
        (course) =>
          !course.primary_offered_course_id &&
          secondaryProgramIds.has(course.master_courses.program_id)
      )
      .map(toSectionOption);

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

    const existingLinks = linkedSections
      .filter((secondary) => {
        const primary = secondary.primary_offered_course;
        if (!primary) return false;

        const primaryProgramMatch = primaryProgramIds.has(primary.master_courses.program_id);
        const secondaryProgramMatch =
          secondaryProgramIds.size === 0 || secondaryProgramIds.has(secondary.master_courses.program_id);

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
      secondarySections,
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
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import { canEditStructure } from "@/lib/offering-status";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source:
    | "EXACT_PROGRAM_CODE"
    | "CANONICAL_PROGRAM"
    | "CURRICULUM_RELATED_PROGRAM";
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

function toMinutes(value: string) {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const a1 = toMinutes(aStart);
  const a2 = toMinutes(aEnd);
  const b1 = toMinutes(bStart);
  const b2 = toMinutes(bEnd);

  if (a1 < 0 || a2 < 0 || b1 < 0 || b2 < 0) return false;
  return a1 < b2 && b1 < a2;
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

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const body = await req.json();

    const offeredCourseId = Number(body.offeredCourseId);
    const programCode = String(body.programCode || "").trim().toUpperCase();
    const batchCode = String(body.batchCode || "").trim();

    if (!Number.isFinite(offeredCourseId) || offeredCourseId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid offeredCourseId is required." },
        { status: 400 }
      );
    }

    if (!programCode) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "programCode is required." },
        { status: 400 }
      );
    }

    if (!batchCode) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "batchCode is required." },
        { status: 400 }
      );
    }

    const offeredCourse = await prisma.offered_courses.findUnique({
      where: {
        id: offeredCourseId,
      },
      include: {
        offerings: true,
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
        offered_course_slots: true,
      },
    });

    if (!offeredCourse) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Offered course not found." },
        { status: 404 }
      );
    }

    if (!canEditStructure(offeredCourse.offerings.status)) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "Only structure-editable offered courses can accept new batches.",
        },
        { status: 400 }
      );
    }

    const candidates = await getProgramCandidates(programCode);
    const candidateProgramIds = candidates.map((item) => item.id);

    const targetBatch = await prisma.batches.findFirst({
      where: {
        batch_code: batchCode,
        program_id: {
          in: candidateProgramIds,
        },
      },
      include: {
        programs: true,
      },
    });

    if (!targetBatch) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: `Batch ${batchCode} was not found under ${programCode}.`,
        },
        { status: 404 }
      );
    }

    const alreadyAttached = offeredCourse.offered_course_batches.some(
      (item) => item.batch_id === targetBatch.id
    );

    if (alreadyAttached) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: `Batch ${targetBatch.batch_code} is already attached to this section row.`,
        },
        { status: 400 }
      );
    }

    const duplicateElsewhereInSameTerm = await prisma.offered_course_batches.findFirst({
      where: {
        batch_id: targetBatch.id,
        offered_courses: {
          id: {
            not: offeredCourse.id,
          },
          master_course_id: offeredCourse.master_course_id,
          offerings: {
            academic_term_id: offeredCourse.offerings.academic_term_id,
            status: {
              in: ["DRAFT", "CONFIRMED"],
            },
          },
        },
      },
      include: {
        offered_courses: {
          include: {
            offerings: {
              include: {
                academic_terms: true,
              },
            },
            master_courses: true,
          },
        },
      },
    });

    if (duplicateElsewhereInSameTerm) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error:
            `${offeredCourse.master_courses.course_code} is already offered for batch ${targetBatch.batch_code} ` +
            `in ${duplicateElsewhereInSameTerm.offered_courses.offerings.academic_terms.name}.`,
        },
        { status: 400 }
      );
    }

    if (offeredCourse.offered_course_slots.length > 0) {
      for (const slot of offeredCourse.offered_course_slots) {
        const sameDayBatchSlots = await prisma.offered_course_slots.findMany({
          where: {
            day_of_week: slot.day_of_week,
            offered_course_id: {
              not: offeredCourse.id,
            },
            offered_courses: {
              offerings: {
                academic_term_id: offeredCourse.offerings.academic_term_id,
                status: {
                  in: ["DRAFT", "CONFIRMED"],
                },
              },
              offered_course_batches: {
                some: {
                  batch_id: targetBatch.id,
                },
              },
            },
          },
          include: {
            offered_courses: {
              include: {
                master_courses: true,
              },
            },
          },
        });

        const conflict = sameDayBatchSlots.find((item) =>
          overlaps(slot.start_time, slot.end_time, item.start_time, item.end_time)
        );

        if (conflict) {
          clearReportingCacheWithLog("offering/reporting data changed");
          return NextResponse.json(
            {
              ok: false,
              error:
                `Batch ${targetBatch.batch_code} has a schedule conflict with ` +
                `${conflict.offered_courses.master_courses.course_code} section ${conflict.offered_courses.section}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    await prisma.offered_course_batches.create({
      data: {
        offered_course_id: offeredCourse.id,
        batch_id: targetBatch.id,
      },
    });

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      ok: true,
      message: "Batch attached successfully.",
      batch: {
        id: targetBatch.id,
        batchCode: targetBatch.batch_code,
        programCode: targetBatch.programs.short_name,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to attach batch.";

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
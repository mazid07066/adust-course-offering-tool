import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";
import { SCHEDULE_CONFLICT_STATUSES } from "@/lib/course-schedule-policy";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import { getExcludedBatchIdsForTerm } from "@/lib/batch-term-offering-status";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source:
    | "EXACT_PROGRAM_CODE"
    | "CANONICAL_PROGRAM"
    | "CURRICULUM_RELATED_PROGRAM";
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);

  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return null;
  }

  return h * 60 + m;
}

function hasTimeOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);

  if (
    aS === null ||
    aE === null ||
    bS === null ||
    bE === null
  ) {
    return false;
  }

  return aS < bE && bS < aE;
}

function uniqueById<T extends { id: number }>(rows: T[]) {
  const seen = new Set<number>();
  const out: T[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

function sourcePriority(source: ProgramCandidate["source"]) {
  if (source === "CANONICAL_PROGRAM") return 1;
  if (source === "EXACT_PROGRAM_CODE") return 2;
  return 3;
}

function normalizeEligibilityCode(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function normalizeEligibilityTitle(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function getProgramCandidates(programCode: string): Promise<{
  normalizedProgramCode: string;
  candidateIds: number[];
  candidates: ProgramCandidate[];
}> {
  const normalizedProgramCode = normalizeUpper(programCode);
  const staticCatalog = getCatalogProgramByCode(normalizedProgramCode);

  if (!staticCatalog) {
    throw new Error("Invalid academic identity programCode.");
  }

  const catalogEntry =
    await prisma.academic_catalog_entries.findUnique({
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
    department_code:
      catalogEntry?.department_code || staticCatalog.departmentCode,
    department_name:
      catalogEntry?.department_name || staticCatalog.departmentName,
    program_code: normalizedProgramCode,
    program_title:
      catalogEntry?.program_title || staticCatalog.programTitle,
    study_shift:
      catalogEntry?.study_shift || staticCatalog.studyShift,
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
    const relatedCatalogEntries =
      await prisma.academic_catalog_entries.findMany({
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

  const uniqueCandidates = uniqueById(candidates);

  return {
    normalizedProgramCode,
    candidateIds: uniqueCandidates.map((item) => item.id),
    candidates: uniqueCandidates,
  };
}

async function getOfferedCourseContext(
  offeredCourseId: number,
  programCode: string
) {
  const resolved = await getProgramCandidates(programCode);

  const offeredCourse = await prisma.offered_courses.findUnique({
    where: {
      id: offeredCourseId,
    },
    select: {
      id: true,
      notes: true,
      section: true,
      master_course_id: true,
      offerings: {
        select: {
          id: true,
          academic_term_id: true,
          program_id: true,
          status: true,
          academic_terms: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      master_courses: {
        select: {
          id: true,
          course_code: true,
          course_title: true,
        },
      },
      offered_course_batches: {
        select: {
          batch_id: true,
          batches: {
            select: {
              batch_code: true,
            },
          },
        },
      },
    },
  });

  if (!offeredCourse) {
    throw new Error("Manual offered course was not found.");
  }

  if (offeredCourse.notes !== "MANUAL_ADDITION") {
    throw new Error("Only manual additions can receive another batch here.");
  }

  if (offeredCourse.offerings.status === "CONFIRMED") {
    throw new Error(
      "Cannot add a batch after the offering becomes CONFIRMED."
    );
  }

  if (!resolved.candidateIds.includes(offeredCourse.offerings.program_id)) {
    throw new Error(
      "The offered course does not belong to the selected academic program identity."
    );
  }

  return {
    resolved,
    offeredCourse,
  };
}

async function getLogicalBatchIds(
  candidateIds: number[],
  batchCode: string
) {
  const rows = await prisma.batches.findMany({
    where: {
      program_id: {
        in: candidateIds,
      },
      batch_code: batchCode,
    },
    select: {
      id: true,
    },
  });

  return rows.map((item) => item.id);
}

async function assertCourseEligibleForBatch(params: {
  candidateIds: number[];
  batchId: number;
  batchCode: string;
  termId: number;
  courseCode: string;
  courseTitle: string;
}) {
  const {
    candidateIds,
    batchId,
    batchCode,
    termId,
    courseCode,
    courseTitle,
  } = params;

  const excluded = await getExcludedBatchIdsForTerm(termId, [batchId]);

  if (excluded.has(batchId)) {
    throw new Error(
      `Batch ${batchCode} is excluded from course offering for this academic term.`
    );
  }

  const logicalBatchIds = await getLogicalBatchIds(
    candidateIds,
    batchCode
  );

  const [completedCourses, ongoingCourses] = await Promise.all([
    prisma.batch_completed_courses.findMany({
      where: {
        batch_id: {
          in: logicalBatchIds,
        },
      },
      select: {
        course_code: true,
        course_title: true,
        normalized_title: true,
      },
    }),

    prisma.batch_current_registrations.findMany({
      where: {
        batch_id: {
          in: logicalBatchIds,
        },
      },
      select: {
        course_code: true,
        course_title: true,
        normalized_title: true,
      },
    }),
  ]);

  const selectedCourseCode = normalizeEligibilityCode(courseCode);
  const selectedCourseTitle = normalizeEligibilityTitle(courseTitle);

  const completed = completedCourses.some(
    (item) =>
      normalizeEligibilityCode(item.course_code) === selectedCourseCode ||
      normalizeEligibilityTitle(
        item.normalized_title || item.course_title
      ) === selectedCourseTitle
  );

  if (completed) {
    throw new Error(
      `Selected course is already completed by batch ${batchCode}.`
    );
  }

  const ongoing = ongoingCourses.some(
    (item) =>
      normalizeEligibilityCode(item.course_code) === selectedCourseCode ||
      normalizeEligibilityTitle(
        item.normalized_title || item.course_title
      ) === selectedCourseTitle
  );

  if (ongoing) {
    throw new Error(
      `Selected course is currently ongoing for batch ${batchCode}.`
    );
  }

  return logicalBatchIds;
}

async function getEligibleAdditionalBatches(params: {
  offeredCourseId: number;
  programCode: string;
}) {
  const { offeredCourseId, programCode } = params;
  const { resolved, offeredCourse } =
    await getOfferedCourseContext(offeredCourseId, programCode);

  const priorityMap = new Map<number, number>();

  for (const candidate of resolved.candidates) {
    priorityMap.set(candidate.id, sourcePriority(candidate.source));
  }

  const rawBatches = await prisma.batches.findMany({
    where: {
      program_id: {
        in: resolved.candidateIds,
      },
      is_active: true,
    },
    orderBy: [
      {
        batch_code: "asc",
      },
      {
        id: "asc",
      },
    ],
    select: {
      id: true,
      program_id: true,
      batch_code: true,
      admission_term: true,
    },
  });

  const bestBatchByCode =
    new Map<string, (typeof rawBatches)[number]>();

  for (const batch of rawBatches) {
    const code = normalizeText(batch.batch_code);

    if (!code) continue;

    const existing = bestBatchByCode.get(code);

    if (!existing) {
      bestBatchByCode.set(code, batch);
      continue;
    }

    const currentPriority =
      priorityMap.get(batch.program_id) ?? 999;

    const existingPriority =
      priorityMap.get(existing.program_id) ?? 999;

    if (currentPriority < existingPriority) {
      bestBatchByCode.set(code, batch);
    }
  }

  const linkedBatchCodes = new Set(
    offeredCourse.offered_course_batches.map((item) =>
      normalizeText(item.batches.batch_code)
    )
  );

  const possible = [...bestBatchByCode.values()].filter(
    (batch) => !linkedBatchCodes.has(normalizeText(batch.batch_code))
  );

  const excludedBatchIds =
    possible.length > 0
      ? await getExcludedBatchIdsForTerm(
          offeredCourse.offerings.academic_term_id,
          possible.map((batch) => batch.id)
        )
      : new Set<number>();

  const eligible: Array<{
    id: number;
    batchCode: string;
    admissionTerm: string | null;
  }> = [];

  for (const batch of possible) {
    if (excludedBatchIds.has(batch.id)) {
      continue;
    }

    try {
      await assertCourseEligibleForBatch({
        candidateIds: resolved.candidateIds,
        batchId: batch.id,
        batchCode: batch.batch_code,
        termId: offeredCourse.offerings.academic_term_id,
        courseCode: offeredCourse.master_courses.course_code,
        courseTitle: offeredCourse.master_courses.course_title,
      });

      eligible.push({
        id: batch.id,
        batchCode: batch.batch_code,
        admissionTerm: batch.admission_term,
      });
    } catch {
      // Ineligible batches are intentionally omitted from the chooser.
    }
  }

  return {
    eligible,
    resolved,
    offeredCourse,
  };
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const { searchParams } = new URL(req.url);

    const offeredCourseId = toNumber(
      searchParams.get("offeredCourseId")
    );

    const programCode = normalizeUpper(
      searchParams.get("programCode")
    );

    if (!offeredCourseId || !programCode) {
      return NextResponse.json(
        {
          error:
            "offeredCourseId and programCode are required.",
        },
        {
          status: 400,
        }
      );
    }

    const { eligible, offeredCourse } =
      await getEligibleAdditionalBatches({
        offeredCourseId,
        programCode,
      });

    return NextResponse.json({
      success: true,
      offeredCourseId,
      courseCode:
        offeredCourse.master_courses.course_code,
      section:
        offeredCourse.section,

      batches: eligible,

      attachedBatches:
        offeredCourse.offered_course_batches.map((item) => ({
          batchId:
            item.batch_id,
          batchCode:
            item.batches.batch_code,
        })),
    });
  } catch (error) {
    console.error(
      "Manual offering add-batch options failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load eligible batches.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const body = await req.json();

    const offeredCourseId = toNumber(
      body.offeredCourseId
    );

    const programCode = normalizeUpper(
      body.programCode
    );

    const batchId = toNumber(
      body.batchId
    );

    if (
      !offeredCourseId ||
      !programCode ||
      !batchId
    ) {
      return NextResponse.json(
        {
          error:
            "offeredCourseId, programCode, and batchId are required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      resolved,
      offeredCourse,
    } = await getOfferedCourseContext(
      offeredCourseId,
      programCode
    );

    const attachedLinks =
      offeredCourse.offered_course_batches;

    if (attachedLinks.length <= 1) {
      return NextResponse.json(
        {
          error:
            "The final remaining batch cannot be removed. Delete the offered course instead if it is no longer required.",
        },
        {
          status: 409,
        }
      );
    }

    const selectedLink =
      attachedLinks.find(
        (item) =>
          item.batch_id === batchId
      );

    if (!selectedLink) {
      return NextResponse.json(
        {
          error:
            "The selected batch is not attached to this offered course.",
        },
        {
          status: 404,
        }
      );
    }

    const selectedBatch =
      await prisma.batches.findFirst({
        where: {
          id: batchId,
          program_id: {
            in: resolved.candidateIds,
          },
        },

        select: {
          id: true,
          batch_code: true,
        },
      });

    if (!selectedBatch) {
      return NextResponse.json(
        {
          error:
            "Selected batch does not belong to the current academic program identity.",
        },
        {
          status: 400,
        }
      );
    }

    await prisma.offered_course_batches.deleteMany({
      where: {
        offered_course_id:
          offeredCourseId,
        batch_id:
          batchId,
      },
    });

    clearReportingCacheWithLog(
      "manual offered course batch removed"
    );

    return NextResponse.json({
      success: true,

      message:
        `Batch ${selectedBatch.batch_code} removed from ${offeredCourse.master_courses.course_code} Sec-${offeredCourse.section}. The course, section, faculty, schedule, room, and co-offering relationship remain unchanged.`,

      offeredCourseId,

      batchId:
        selectedBatch.id,

      batchCode:
        selectedBatch.batch_code,
    });
  } catch (error) {
    console.error(
      "Manual offering remove-batch failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove batch from manual offered course.",
      },
      {
        status: 500,
      }
    );
  }
}
export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const body = await req.json();

    const offeredCourseId = toNumber(
      body.offeredCourseId
    );

    const programCode = normalizeUpper(
      body.programCode
    );

    const batchId = toNumber(
      body.batchId
    );

    if (!offeredCourseId || !programCode || !batchId) {
      return NextResponse.json(
        {
          error:
            "offeredCourseId, programCode, and batchId are required.",
        },
        {
          status: 400,
        }
      );
    }

    const { resolved, offeredCourse } =
      await getOfferedCourseContext(
        offeredCourseId,
        programCode
      );

    const selectedBatch = await prisma.batches.findFirst({
      where: {
        id: batchId,
        program_id: {
          in: resolved.candidateIds,
        },
        is_active: true,
      },
      select: {
        id: true,
        program_id: true,
        batch_code: true,
        admission_term: true,
      },
    });

    if (!selectedBatch) {
      return NextResponse.json(
        {
          error:
            "Selected batch is not active or does not belong to the selected academic program identity.",
        },
        {
          status: 400,
        }
      );
    }

    const existingLinkedCodes = new Set(
      offeredCourse.offered_course_batches.map((item) =>
        normalizeText(item.batches.batch_code)
      )
    );

    if (
      existingLinkedCodes.has(
        normalizeText(selectedBatch.batch_code)
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Batch ${selectedBatch.batch_code} is already attached to this offered course.`,
        },
        {
          status: 409,
        }
      );
    }

    const logicalBatchIds =
      await assertCourseEligibleForBatch({
        candidateIds:
          resolved.candidateIds,
        batchId:
          selectedBatch.id,
        batchCode:
          selectedBatch.batch_code,
        termId:
          offeredCourse.offerings.academic_term_id,
        courseCode:
          offeredCourse.master_courses.course_code,
        courseTitle:
          offeredCourse.master_courses.course_title,
      });

    const existingCourseSlots =
      await prisma.offered_course_slots.findMany({
        where: {
          offered_course_id:
            offeredCourseId,
        },
        select: {
          day_of_week: true,
          start_time: true,
          end_time: true,
        },
      });

    for (const slot of existingCourseSlots) {
      const possibleConflicts =
        await prisma.offered_course_slots.findMany({
          where: {
            offered_course_id: {
              not: offeredCourseId,
            },
            day_of_week:
              slot.day_of_week,
            offered_courses: {
              offerings: {
                academic_term_id:
                  offeredCourse.offerings.academic_term_id,
                status: {
                  in: SCHEDULE_CONFLICT_STATUSES,
                },
              },
              offered_course_batches: {
                some: {
                  batch_id: {
                    in: logicalBatchIds,
                  },
                },
              },
            },
          },
          select: {
            offered_course_id: true,
            day_of_week: true,
            start_time: true,
            end_time: true,
          },
        });

      const conflict = possibleConflicts.find((item) =>
        hasTimeOverlap(
          slot.start_time,
          slot.end_time,
          item.start_time,
          item.end_time
        )
      );

      if (conflict) {
        const conflictCourse =
          await prisma.offered_courses.findUnique({
            where: {
              id: conflict.offered_course_id,
            },
            select: {
              section: true,
              master_courses: {
                select: {
                  course_code: true,
                  course_title: true,
                },
              },
            },
          });

        return NextResponse.json(
          {
            error:
              `Cannot add batch ${selectedBatch.batch_code}. Schedule conflict: ${conflictCourse?.master_courses.course_code || "another course"} Sec-${conflictCourse?.section || "-"} already runs ${conflict.day_of_week} ${conflict.start_time}-${conflict.end_time}, overlapping this offered course at ${slot.start_time}-${slot.end_time}.`,
          },
          {
            status: 409,
          }
        );
      }
    }

    await prisma.offered_course_batches.create({
      data: {
        offered_course_id:
          offeredCourseId,
        batch_id:
          selectedBatch.id,
      },
    });

    clearReportingCacheWithLog(
      "manual offered course batch attached"
    );

    return NextResponse.json({
      success: true,
      message:
        `Batch ${selectedBatch.batch_code} added to ${offeredCourse.master_courses.course_code} Sec-${offeredCourse.section}. The existing section, faculty, room, and schedule are shared.`,
      offeredCourseId,
      batchId:
        selectedBatch.id,
      batchCode:
        selectedBatch.batch_code,
    });
  } catch (error) {
    console.error(
      "Manual offering add-batch failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to add batch to manual offered course.",
      },
      {
        status: 500,
      }
    );
  }
}

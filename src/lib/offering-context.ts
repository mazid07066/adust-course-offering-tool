import { prisma } from "@/lib/prisma";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import { getLatestTerm, getNextSemester } from "@/lib/semester-utils";

type MasterCourseRow = {
  id: number;
  program_id: number;
  curriculum_key: string | null;
  course_code: string;
  course_title: string;
  normalized_title: string;
  credit: number;
  course_type: string;
  level_term: string | null;
  group_name: string | null;
};

type CompletedRow = {
  id: number;
  course_code: string;
  course_title: string;
  normalized_title: string;
  credit: number;
  grade: string | null;
  academic_terms: {
    name: string;
  } | null;
};

type OngoingRow = {
  id: number;
  course_code: string;
  course_title: string;
  normalized_title: string;
  credit: number;
  academic_terms: {
    name: string;
  } | null;
};

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source:
    | "EXACT_PROGRAM_CODE"
    | "CANONICAL_PROGRAM"
    | "CURRICULUM_RELATED_PROGRAM";
};

export type OfferingContextCourse = {
  id: number;
  courseCode: string;
  courseTitle: string;
  normalizedTitle: string | null;
  credit: number | null;
  courseType: string | null;
  levelTerm: string | null;
  groupName: string | null;
  status: "COMPLETED" | "ONGOING" | "REMAINING";
};

export type OfferingContextResult = {
  ok: true;
  success: true;

  programId: number;
  programCode: string;
  programLabel: string;

  resolvedBatchProgramId: number;
  resolvedBatchProgramShortName: string;
  resolvedBatchProgramName: string;

  batchId: number;
  batchCode: string;
  batchAdmissionTerm: string | null;

  currentTermName: string | null;
  latestCompletedAcademicTerm: string | null;
  suggestedOfferingAcademicTerm: string | null;

  latestCompletedLevelTerm: string | null;
  latestOngoingLevelTerm: string | null;
  suggestedNextLevelTerm: string | null;

  completedCount: number;
  ongoingCount: number;
  remainingCount: number;
  totalCourses: number;

  completedCourses: OfferingContextCourse[];
  ongoingCourses: OfferingContextCourse[];
  remainingCourses: OfferingContextCourse[];
  candidateCoursesForNextOffering: OfferingContextCourse[];

  academicProgress: {
    latestCompletedTerm: string | null;
    currentRegistrationTerm: string | null;
    suggestedOfferingTerm: string | null;
  };

  summary: {
    totalCourses: number;
    completedCourses: number;
    ongoingCourses: number;
    remainingCourses: number;
  };
};

function normalizeCode(value: string | null | undefined): string {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[-–—]/g, "");
}

function normalizeTitle(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLevelTerm(
  levelTerm: string | null | undefined
): { level: number; term: number } | null {
  const raw = String(levelTerm || "").trim().toUpperCase();
  if (!raw) return null;

  let match = raw.match(/^(\d+)[.\-_/ ](\d+)$/);
  if (match) {
    return {
      level: Number(match[1]),
      term: Number(match[2]),
    };
  }

  match = raw.match(/^L?\s*(\d+)\s*T?\s*(\d+)$/i);
  if (match) {
    return {
      level: Number(match[1]),
      term: Number(match[2]),
    };
  }

  return null;
}

function compareLevelTerms(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const pa = parseLevelTerm(a);
  const pb = parseLevelTerm(b);

  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;

  if (pa.level !== pb.level) {
    return pa.level - pb.level;
  }

  return pa.term - pb.term;
}

function formatLevelTerm(level: number, term: number): string {
  return `${level}.${term}`;
}

function getNextLevelTerm(levelTerm: string | null | undefined): string | null {
  const parsed = parseLevelTerm(levelTerm);
  if (!parsed) return null;

  if (parsed.term < 3) {
    return formatLevelTerm(parsed.level, parsed.term + 1);
  }

  return formatLevelTerm(parsed.level + 1, 1);
}

function safeGetNextSemester(termName: string | null | undefined): string | null {
  const raw = String(termName || "").trim();
  if (!raw) return null;

  try {
    return getNextSemester(raw);
  } catch {
    return null;
  }
}

function toUiCourse(
  row: MasterCourseRow,
  status: "COMPLETED" | "ONGOING" | "REMAINING"
): OfferingContextCourse {
  return {
    id: row.id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    normalizedTitle: row.normalized_title || null,
    credit: row.credit ?? null,
    courseType: row.course_type || null,
    levelTerm: row.level_term || null,
    groupName: row.group_name || null,
    status,
  };
}

function masterMatchesSaved(
  master: Pick<MasterCourseRow, "course_code" | "course_title" | "normalized_title">,
  saved: Pick<CompletedRow, "course_code" | "course_title" | "normalized_title"> |
         Pick<OngoingRow, "course_code" | "course_title" | "normalized_title">
): boolean {
  const masterCode = normalizeCode(master.course_code);
  const savedCode = normalizeCode(saved.course_code);

  if (masterCode && savedCode && masterCode === savedCode) {
    return true;
  }

  const masterTitle = normalizeTitle(master.normalized_title || master.course_title);
  const savedTitle = normalizeTitle(saved.normalized_title || saved.course_title);

  if (masterTitle && savedTitle && masterTitle === savedTitle) {
    return true;
  }

  return false;
}

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

function uniqueCoursesByComparableIdentity(rows: MasterCourseRow[]): MasterCourseRow[] {
  const seen = new Set<string>();
  const out: MasterCourseRow[] = [];

  for (const row of rows) {
    const key =
      normalizeCode(row.course_code) ||
      normalizeTitle(row.normalized_title || row.course_title);

    if (!key) continue;
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(row);
  }

  return out;
}

async function getProgramCandidates(programCode: string): Promise<{
  requestedProgramCode: string;
  requestedProgramLabel: string;
  curriculumKey: string | null;
  candidates: ProgramCandidate[];
}> {
  const normalizedProgramCode = String(programCode || "").trim().toUpperCase();
  if (!normalizedProgramCode) {
    throw new Error("programCode is required.");
  }

  const catalogStatic = getCatalogProgramByCode(normalizedProgramCode);
  if (!catalogStatic) {
    throw new Error("Invalid academic identity programCode.");
  }

  const catalogEntry = await prisma.academic_catalog_entries.findUnique({
    where: {
      program_code: normalizedProgramCode,
    },
    select: {
      program_code: true,
      display_label: true,
      curriculum_key: true,
      department_code: true,
      department_name: true,
      program_title: true,
      study_shift: true,
    },
  });

  const requestedProgramLabel =
    catalogEntry?.display_label || catalogStatic.displayLabel;

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
    department_code: catalogEntry?.department_code || catalogStatic.departmentCode,
    department_name: catalogEntry?.department_name || catalogStatic.departmentName,
    program_code: normalizedProgramCode,
    program_title: catalogEntry?.program_title || catalogStatic.programTitle,
    study_shift: catalogEntry?.study_shift || catalogStatic.studyShift,
  });

  if (
    !candidates.some((item) => item.id === canonicalProgram.id)
  ) {
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

  return {
    requestedProgramCode: normalizedProgramCode,
    requestedProgramLabel,
    curriculumKey,
    candidates: uniqueById(candidates),
  };
}

async function resolveBatchForProgramCode(programCode: string, batchCode: string) {
  const resolved = await getProgramCandidates(programCode);

  if (resolved.candidates.length === 0) {
    throw new Error("No program candidate could be resolved for the selected academic identity.");
  }

  const batches = await prisma.batches.findMany({
    where: {
      program_id: {
        in: resolved.candidates.map((item) => item.id),
      },
      batch_code: String(batchCode || "").trim(),
    },
    select: {
      id: true,
      batch_code: true,
      admission_term: true,
      program_id: true,
      programs: {
        select: {
          id: true,
          short_name: true,
          name: true,
        },
      },
    },
  });

  if (batches.length === 0) {
    const searchedPrograms = resolved.candidates
      .map((item) => `${item.short_name} [${item.source}]`)
      .join(", ");

    throw new Error(
      `Batch not found for the selected academic identity. Searched programs: ${searchedPrograms}`
    );
  }

  const preferredOrder = new Map<number, number>();
  resolved.candidates.forEach((item, index) => {
    preferredOrder.set(item.id, index);
  });

  batches.sort((a, b) => {
    const pa = preferredOrder.get(a.program_id) ?? 9999;
    const pb = preferredOrder.get(b.program_id) ?? 9999;
    return pa - pb;
  });

  const selectedBatch = batches[0];
  const selectedProgram = resolved.candidates.find(
    (item) => item.id === selectedBatch.program_id
  );

  if (!selectedProgram) {
    throw new Error("Resolved batch program could not be matched.");
  }

  return {
    requestedProgramCode: resolved.requestedProgramCode,
    requestedProgramLabel: resolved.requestedProgramLabel,
    curriculumKey: resolved.curriculumKey,
    candidatePrograms: resolved.candidates,
    batch: selectedBatch,
    resolvedBatchProgram: selectedProgram,
  };
}

async function loadMasterCoursesForContext(params: {
  requestedProgramCode: string;
  curriculumKey: string | null;
  candidatePrograms: ProgramCandidate[];
  resolvedBatchProgramId: number;
}) {
  const { requestedProgramCode, curriculumKey, candidatePrograms, resolvedBatchProgramId } = params;

  let rows: MasterCourseRow[] = [];

  if (curriculumKey) {
    rows = await prisma.master_courses.findMany({
      where: {
        curriculum_key: curriculumKey,
        is_active: true,
      },
      orderBy: [{ level_term: "asc" }, { course_code: "asc" }],
      select: {
        id: true,
        program_id: true,
        curriculum_key: true,
        course_code: true,
        course_title: true,
        normalized_title: true,
        credit: true,
        course_type: true,
        level_term: true,
        group_name: true,
      },
    });
  }

  if (rows.length === 0) {
    rows = await prisma.master_courses.findMany({
      where: {
        OR: [
          {
            program_id: resolvedBatchProgramId,
            is_active: true,
          },
          {
            program_id: {
              in: candidatePrograms.map((item) => item.id),
            },
            is_active: true,
          },
        ],
      },
      orderBy: [{ level_term: "asc" }, { course_code: "asc" }],
      select: {
        id: true,
        program_id: true,
        curriculum_key: true,
        course_code: true,
        course_title: true,
        normalized_title: true,
        credit: true,
        course_type: true,
        level_term: true,
        group_name: true,
      },
    });
  }

  const exactProgramRows = rows.filter((row) => {
    const owner = candidatePrograms.find((item) => item.id === row.program_id);
    return owner?.short_name === requestedProgramCode;
  });

  const resolvedBatchProgramRows = rows.filter(
    (row) => row.program_id === resolvedBatchProgramId
  );

  const finalRows =
    exactProgramRows.length > 0
      ? exactProgramRows
      : resolvedBatchProgramRows.length > 0
      ? resolvedBatchProgramRows
      : rows;

  return uniqueCoursesByComparableIdentity(finalRows).sort((a, b) => {
    const lt = compareLevelTerms(a.level_term, b.level_term);
    if (lt !== 0) return lt;
    return a.course_code.localeCompare(b.course_code);
  });
}

function resolveCourseLevelTermFromMaster(
  saved:
    | Pick<CompletedRow, "course_code" | "course_title" | "normalized_title">
    | Pick<OngoingRow, "course_code" | "course_title" | "normalized_title">,
  masterCourses: MasterCourseRow[]
): string | null {
  const match = masterCourses.find((master) => masterMatchesSaved(master, saved));
  return match?.level_term || null;
}

export async function buildOfferingContext(params: {
  programCode: string;
  batchCode: string;
}): Promise<OfferingContextResult> {
  const programCode = String(params.programCode || "").trim().toUpperCase();
  const batchCode = String(params.batchCode || "").trim();

  if (!programCode) {
    throw new Error("programCode is required.");
  }

  if (!batchCode) {
    throw new Error("batchCode is required.");
  }

  const resolved = await resolveBatchForProgramCode(programCode, batchCode);

  const masterCourses = await loadMasterCoursesForContext({
    requestedProgramCode: resolved.requestedProgramCode,
    curriculumKey: resolved.curriculumKey,
    candidatePrograms: resolved.candidatePrograms,
    resolvedBatchProgramId: resolved.batch.program_id,
  });

  const [completedRows, ongoingRows] = await Promise.all([
    prisma.batch_completed_courses.findMany({
      where: {
        batch_id: resolved.batch.id,
      },
      orderBy: [{ course_code: "asc" }],
      select: {
        id: true,
        course_code: true,
        course_title: true,
        normalized_title: true,
        credit: true,
        grade: true,
        academic_terms: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.batch_current_registrations.findMany({
      where: {
        batch_id: resolved.batch.id,
      },
      orderBy: [{ course_code: "asc" }],
      select: {
        id: true,
        course_code: true,
        course_title: true,
        normalized_title: true,
        credit: true,
        academic_terms: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const currentTermName = getLatestTerm(
    ongoingRows.map((row) => row.academic_terms?.name)
  );

  const latestCompletedAcademicTerm = getLatestTerm(
    completedRows.map((row) => row.academic_terms?.name)
  );

  const completedCourses: OfferingContextCourse[] = [];
  const ongoingCourses: OfferingContextCourse[] = [];
  const remainingCourses: OfferingContextCourse[] = [];

  for (const master of masterCourses) {
    const completedMatch = completedRows.find((row) => masterMatchesSaved(master, row));
    if (completedMatch) {
      completedCourses.push(toUiCourse(master, "COMPLETED"));
      continue;
    }

    const ongoingMatch = ongoingRows.find((row) => masterMatchesSaved(master, row));
    if (ongoingMatch) {
      ongoingCourses.push(toUiCourse(master, "ONGOING"));
      continue;
    }

    remainingCourses.push(toUiCourse(master, "REMAINING"));
  }

  let latestCompletedLevelTerm: string | null = null;
  for (const row of completedRows) {
    const levelTerm = resolveCourseLevelTermFromMaster(row, masterCourses);
    if (!levelTerm) continue;

    if (!latestCompletedLevelTerm || compareLevelTerms(levelTerm, latestCompletedLevelTerm) > 0) {
      latestCompletedLevelTerm = levelTerm;
    }
  }

  let latestOngoingLevelTerm: string | null = null;
  for (const row of ongoingRows) {
    const levelTerm = resolveCourseLevelTermFromMaster(row, masterCourses);
    if (!levelTerm) continue;

    if (!latestOngoingLevelTerm || compareLevelTerms(levelTerm, latestOngoingLevelTerm) > 0) {
      latestOngoingLevelTerm = levelTerm;
    }
  }

  const suggestedNextLevelTerm =
    getNextLevelTerm(latestOngoingLevelTerm || latestCompletedLevelTerm) || null;

  const suggestedOfferingAcademicTerm =
    safeGetNextSemester(currentTermName) ||
    safeGetNextSemester(latestCompletedAcademicTerm) ||
    resolved.batch.admission_term ||
    null;

  let candidateCoursesForNextOffering = remainingCourses;

  if (suggestedNextLevelTerm) {
    const exactRows = remainingCourses.filter(
      (course) => String(course.levelTerm || "").trim() === suggestedNextLevelTerm
    );

    if (exactRows.length > 0) {
      candidateCoursesForNextOffering = exactRows;
    }
  } else {
    const levelTermGroups = remainingCourses
      .map((row) => row.levelTerm)
      .filter((value): value is string => Boolean(value))
      .sort(compareLevelTerms);

    if (levelTermGroups.length > 0) {
      const earliest = levelTermGroups[0];
      candidateCoursesForNextOffering = remainingCourses.filter(
        (course) => course.levelTerm === earliest
      );
    }
  }

  const result: OfferingContextResult = {
    ok: true,
    success: true,

    programId: resolved.resolvedBatchProgram.id,
    programCode: resolved.requestedProgramCode,
    programLabel: resolved.requestedProgramLabel,

    resolvedBatchProgramId: resolved.resolvedBatchProgram.id,
    resolvedBatchProgramShortName: resolved.resolvedBatchProgram.short_name,
    resolvedBatchProgramName: resolved.resolvedBatchProgram.name,

    batchId: resolved.batch.id,
    batchCode: resolved.batch.batch_code,
    batchAdmissionTerm: resolved.batch.admission_term || null,

    currentTermName,
    latestCompletedAcademicTerm,
    suggestedOfferingAcademicTerm,

    latestCompletedLevelTerm,
    latestOngoingLevelTerm,
    suggestedNextLevelTerm,

    completedCount: completedCourses.length,
    ongoingCount: ongoingCourses.length,
    remainingCount: remainingCourses.length,
    totalCourses: masterCourses.length,

    completedCourses,
    ongoingCourses,
    remainingCourses,
    candidateCoursesForNextOffering,

    academicProgress: {
      latestCompletedTerm: latestCompletedAcademicTerm,
      currentRegistrationTerm: currentTermName,
      suggestedOfferingTerm: suggestedOfferingAcademicTerm,
    },

    summary: {
      totalCourses: masterCourses.length,
      completedCourses: completedCourses.length,
      ongoingCourses: ongoingCourses.length,
      remainingCourses: remainingCourses.length,
    },
  };

  return result;
}
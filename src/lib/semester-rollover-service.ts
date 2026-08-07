import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SemesterRolloverErrorCode =
  | "INVALID_INPUT"
  | "ACADEMIC_TERM_NOT_FOUND"
  | "NO_OFFERINGS_FOUND";

export class SemesterRolloverError extends Error {
  readonly code: SemesterRolloverErrorCode;

  constructor(code: SemesterRolloverErrorCode, message: string) {
    super(message);
    this.name = "SemesterRolloverError";
    this.code = code;
  }
}

type PrepareSemesterRolloverInput = {
  academicTermName: string;
  createdByUserId: number;
  archiveNote?: string | null;
};

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SemesterRolloverError(
      "INVALID_INPUT",
      `${label} must be a positive integer.`
    );
  }

  return value;
}

function normalizeTermName(value: string): string {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  if (!normalized) {
    throw new SemesterRolloverError(
      "INVALID_INPUT",
      "academicTermName is required."
    );
  }

  return normalized;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function buildProgramRolloverSnapshot(params: {
  academicTermId: number;
  programId: number;
}) {
  const { academicTermId, programId } = params;

  const academicTerm = await prisma.academic_terms.findUnique({
    where: {
      id: academicTermId,
    },
    select: {
      id: true,
      name: true,
      year: true,
      term_type: true,
      is_active: true,
      is_current: true,
    },
  });

  if (!academicTerm) {
    throw new SemesterRolloverError(
      "ACADEMIC_TERM_NOT_FOUND",
      "Academic term was not found."
    );
  }

  const program = await prisma.programs.findUnique({
    where: {
      id: programId,
    },
    select: {
      id: true,
      name: true,
      short_name: true,
      department_id: true,
      departments: {
        select: {
          id: true,
          name: true,
          short_name: true,
        },
      },
    },
  });

  if (!program) {
    throw new SemesterRolloverError(
      "INVALID_INPUT",
      `Program ${programId} was not found.`
    );
  }

  const offerings = await prisma.offerings.findMany({
    where: {
      academic_term_id: academicTermId,
      program_id: programId,
    },
    orderBy: {
      id: "asc",
    },
    select: {
      id: true,
      academic_term_id: true,
      program_id: true,
      prepared_by_user_id: true,
      status: true,
      created_at: true,

      users: {
        select: {
          id: true,
          username: true,
          full_name: true,
          role: true,
        },
      },

      offered_courses: {
        orderBy: {
          id: "asc",
        },
        select: {
          id: true,
          offering_id: true,
          master_course_id: true,
          section: true,
          is_cooffered: true,
          primary_offered_course_id: true,
          notes: true,

          master_courses: {
            select: {
              id: true,
              program_id: true,
              course_code: true,
              course_title: true,
              normalized_title: true,
              credit: true,
              course_type: true,
              level_term: true,
              group_name: true,
              curriculum_key: true,
              is_active: true,
            },
          },

          offered_course_batches: {
            orderBy: {
              id: "asc",
            },
            select: {
              id: true,
              batch_id: true,

              batches: {
                select: {
                  id: true,
                  program_id: true,
                  batch_code: true,
                  admission_term: true,
                  is_active: true,

                  programs: {
                    select: {
                      id: true,
                      name: true,
                      short_name: true,
                    },
                  },
                },
              },
            },
          },

          offered_course_teachers: {
            orderBy: {
              id: "asc",
            },
            select: {
              id: true,
              teacher_id: true,
              assigned_credit: true,
              load_type: true,

              teachers: {
                select: {
                  id: true,
                  teacher_code: true,
                  full_name: true,
                  designation: true,
                  is_active: true,
                },
              },
            },
          },

          offered_course_slots: {
            orderBy: {
              id: "asc",
            },
            select: {
              id: true,
              day_of_week: true,
              start_time: true,
              end_time: true,
              room_id: true,
              slot_type: true,

              rooms: {
                select: {
                  id: true,
                  room_code: true,
                  room_type: true,
                  capacity: true,
                  is_active: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const linkedBatchIds = Array.from(
    new Set(
      offerings.flatMap((offering) =>
        offering.offered_courses.flatMap((course) =>
          course.offered_course_batches.map(
            (link) => link.batch_id
          )
        )
      )
    )
  ).sort((a, b) => a - b);

  const linkedBatches =
    linkedBatchIds.length > 0
      ? await prisma.batches.findMany({
          where: {
            id: {
              in: linkedBatchIds,
            },
          },
          orderBy: [
            {
              program_id: "asc",
            },
            {
              batch_code: "asc",
            },
          ],
          select: {
            id: true,
            program_id: true,
            batch_code: true,
            admission_term: true,
            is_active: true,

            programs: {
              select: {
                id: true,
                name: true,
                short_name: true,
              },
            },

            batch_completed_courses: {
              orderBy: [
                {
                  academic_term_id: "asc",
                },
                {
                  course_code: "asc",
                },
              ],
              select: {
                id: true,
                batch_id: true,
                academic_term_id: true,
                course_code: true,
                course_title: true,
                normalized_title: true,
                credit: true,
                grade: true,
                source_student_id: true,
                source_file_name: true,

                academic_terms: {
                  select: {
                    id: true,
                    name: true,
                    year: true,
                    term_type: true,
                  },
                },
              },
            },

            batch_current_registrations: {
              orderBy: [
                {
                  academic_term_id: "asc",
                },
                {
                  course_code: "asc",
                },
              ],
              select: {
                id: true,
                batch_id: true,
                academic_term_id: true,
                course_code: true,
                course_title: true,
                normalized_title: true,
                credit: true,
                source_student_id: true,
                source_file_name: true,

                academic_terms: {
                  select: {
                    id: true,
                    name: true,
                    year: true,
                    term_type: true,
                  },
                },
              },
            },
          },
        })
      : [];

  const completedRows = linkedBatches.reduce(
    (sum, batch) =>
      sum + batch.batch_completed_courses.length,
    0
  );

  const currentRows = linkedBatches.reduce(
    (sum, batch) =>
      sum + batch.batch_current_registrations.length,
    0
  );

  const completedTerms = Array.from(
    new Set(
      linkedBatches.flatMap((batch) =>
        batch.batch_completed_courses
          .map((row) => row.academic_terms?.name ?? null)
          .filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0
          )
      )
    )
  ).sort();

  const currentRegistrationTerms = Array.from(
    new Set(
      linkedBatches.flatMap((batch) =>
        batch.batch_current_registrations
          .map((row) => row.academic_terms?.name ?? null)
          .filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0
          )
      )
    )
  ).sort();

  return toPrismaJson({
    schema: "semester-rollover-v1",

    generatedAt: new Date().toISOString(),

    archivePurpose:
      "Semester offering and linked-batch academic-status rollover snapshot",

    academicTerm,

    program,

    summary: {
      offeringCount: offerings.length,

      offeredCourseCount: offerings.reduce(
        (sum, offering) =>
          sum + offering.offered_courses.length,
        0
      ),

      linkedBatchCount: linkedBatches.length,

      completedCourseRows: completedRows,

      currentRegistrationRows: currentRows,

      completedTermsObserved: completedTerms,

      currentRegistrationTermsObserved:
        currentRegistrationTerms,
    },

    offerings,

    batchAcademicStatus: linkedBatches,
  });
}

export async function prepareSemesterRolloverArchives(
  input: PrepareSemesterRolloverInput
) {
  const academicTermName = normalizeTermName(
    input.academicTermName
  );

  const createdByUserId = requirePositiveInteger(
    input.createdByUserId,
    "createdByUserId"
  );

  const archiveNote =
    typeof input.archiveNote === "string"
      ? input.archiveNote.trim() || null
      : null;

  const academicTerm = await prisma.academic_terms.findUnique({
    where: {
      name: academicTermName,
    },
    select: {
      id: true,
      name: true,
      year: true,
      term_type: true,
      is_active: true,
      is_current: true,
    },
  });

  if (!academicTerm) {
    throw new SemesterRolloverError(
      "ACADEMIC_TERM_NOT_FOUND",
      `Academic term "${academicTermName}" was not found.`
    );
  }

  const offeringPrograms = await prisma.offerings.findMany({
    where: {
      academic_term_id: academicTerm.id,
    },
    distinct: ["program_id"],
    orderBy: {
      program_id: "asc",
    },
    select: {
      program_id: true,
      programs: {
        select: {
          id: true,
          name: true,
          short_name: true,
        },
      },
    },
  });

  if (offeringPrograms.length === 0) {
    throw new SemesterRolloverError(
      "NO_OFFERINGS_FOUND",
      `No offerings were found for ${academicTerm.name}.`
    );
  }

  const created: Array<{
    archiveId: number;
    programId: number;
    programCode: string;
    programName: string;
    version: number;
    status: string;
  }> = [];

  const skippedDrafts: Array<{
    archiveId: number;
    programId: number;
    programCode: string;
    programName: string;
    version: number;
    status: string;
  }> = [];

  const skippedFinalized: Array<{
    archiveId: number;
    programId: number;
    programCode: string;
    programName: string;
    version: number;
    status: string;
  }> = [];

  for (const offeringProgram of offeringPrograms) {
    const programId = offeringProgram.program_id;

    const existingLatest =
      await prisma.semester_archives.findFirst({
        where: {
          academic_term_id: academicTerm.id,
          program_id: programId,
        },
        orderBy: {
          version: "desc",
        },
        select: {
          id: true,
          version: true,
          status: true,
        },
      });

    const programCode =
      offeringProgram.programs.short_name;

    const programName =
      offeringProgram.programs.name;

    if (existingLatest?.status === "FINALIZED") {
      skippedFinalized.push({
        archiveId: existingLatest.id,
        programId,
        programCode,
        programName,
        version: existingLatest.version,
        status: existingLatest.status,
      });

      continue;
    }

    if (existingLatest?.status === "DRAFT") {
      skippedDrafts.push({
        archiveId: existingLatest.id,
        programId,
        programCode,
        programName,
        version: existingLatest.version,
        status: existingLatest.status,
      });

      continue;
    }

    const snapshotJson =
      await buildProgramRolloverSnapshot({
        academicTermId: academicTerm.id,
        programId,
      });

    const nextVersion =
      (existingLatest?.version ?? 0) + 1;

    const archive =
      await prisma.semester_archives.create({
        data: {
          academic_term_id: academicTerm.id,
          program_id: programId,
          version: nextVersion,
          status: "DRAFT",
          snapshot_json: snapshotJson,
          snapshot_schema: "semester-rollover-v1",
          archive_note:
            archiveNote ??
            `${academicTerm.name} semester rollover snapshot`,
          created_by_user_id: createdByUserId,
        },
        select: {
          id: true,
          version: true,
          status: true,
        },
      });

    created.push({
      archiveId: archive.id,
      programId,
      programCode,
      programName,
      version: archive.version,
      status: archive.status,
    });
  }

  return {
    success: true,

    academicTerm,

    offeringProgramCount: offeringPrograms.length,

    createdCount: created.length,

    skippedDraftCount: skippedDrafts.length,

    skippedFinalizedCount: skippedFinalized.length,

    created,

    skippedDrafts,

    skippedFinalized,
  };
}

export async function getSemesterRolloverPreview(
  academicTermNameInput: string
) {
  const academicTermName = normalizeTermName(
    academicTermNameInput
  );

  const academicTerm = await prisma.academic_terms.findUnique({
    where: {
      name: academicTermName,
    },
    select: {
      id: true,
      name: true,
      year: true,
      term_type: true,
      is_active: true,
      is_current: true,
    },
  });

  if (!academicTerm) {
    throw new SemesterRolloverError(
      "ACADEMIC_TERM_NOT_FOUND",
      `Academic term "${academicTermName}" was not found.`
    );
  }

  const programs = await prisma.offerings.findMany({
    where: {
      academic_term_id: academicTerm.id,
    },
    distinct: ["program_id"],
    orderBy: {
      program_id: "asc",
    },
    select: {
      program_id: true,

      programs: {
        select: {
          id: true,
          name: true,
          short_name: true,
        },
      },
    },
  });

  const preview = [];

  for (const row of programs) {
    const offeringCount = await prisma.offerings.count({
      where: {
        academic_term_id: academicTerm.id,
        program_id: row.program_id,
      },
    });

    const offeredCourses =
      await prisma.offered_courses.findMany({
        where: {
          offerings: {
            academic_term_id: academicTerm.id,
            program_id: row.program_id,
          },
        },
        select: {
          id: true,
          offered_course_batches: {
            select: {
              batch_id: true,
            },
          },
        },
      });

    const linkedBatchIds = Array.from(
      new Set(
        offeredCourses.flatMap((course) =>
          course.offered_course_batches.map(
            (link) => link.batch_id
          )
        )
      )
    );

    const completedCourseRows =
      linkedBatchIds.length > 0
        ? await prisma.batch_completed_courses.count({
            where: {
              batch_id: {
                in: linkedBatchIds,
              },
            },
          })
        : 0;

    const currentRegistrationRows =
      linkedBatchIds.length > 0
        ? await prisma.batch_current_registrations.count({
            where: {
              batch_id: {
                in: linkedBatchIds,
              },
            },
          })
        : 0;

    const existingArchive =
      await prisma.semester_archives.findFirst({
        where: {
          academic_term_id: academicTerm.id,
          program_id: row.program_id,
        },
        orderBy: {
          version: "desc",
        },
        select: {
          id: true,
          version: true,
          status: true,
          snapshot_schema: true,
        },
      });

    preview.push({
      programId: row.program_id,
      programCode: row.programs.short_name,
      programName: row.programs.name,
      offeringCount,
      offeredCourseCount: offeredCourses.length,
      linkedBatchCount: linkedBatchIds.length,
      linkedBatchIds,
      completedCourseRows,
      currentRegistrationRows,
      existingArchive,
    });
  }

  return {
    success: true,
    academicTerm,
    programCount: preview.length,
    programs: preview,
  };
}

export function getSemesterRolloverErrorStatus(
  error: unknown
): number {
  if (!(error instanceof SemesterRolloverError)) {
    return 500;
  }

  if (error.code === "ACADEMIC_TERM_NOT_FOUND") {
    return 404;
  }

  if (error.code === "NO_OFFERINGS_FOUND") {
    return 409;
  }

  return 400;
}
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SemesterArchiveServiceErrorCode =
  | "INVALID_INPUT"
  | "ACADEMIC_TERM_NOT_FOUND"
  | "PROGRAM_NOT_FOUND"
  | "ARCHIVE_NOT_FOUND"
  | "ARCHIVE_ALREADY_FINALIZED"
  | "ARCHIVE_CREATE_CONFLICT";

export class SemesterArchiveServiceError extends Error {
  readonly code: SemesterArchiveServiceErrorCode;

  constructor(code: SemesterArchiveServiceErrorCode, message: string) {
    super(message);
    this.name = "SemesterArchiveServiceError";
    this.code = code;
  }
}

type CreateSemesterArchiveDraftInput = {
  academicTermId: number;
  programId: number;
  createdByUserId: number;
  archiveNote?: string | null;
};

type ListSemesterArchivesInput = {
  academicTermId?: number | null;
  programId?: number | null;
  status?: string | null;
};

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SemesterArchiveServiceError(
      "INVALID_INPUT",
      `${label} must be a positive integer.`
    );
  }

  return value;
}

function normalizeArchiveStatus(
  value: string | null | undefined
): "DRAFT" | "FINALIZED" | undefined {
  if (!value) return undefined;

  const normalized = value.trim().toUpperCase();

  if (normalized !== "DRAFT" && normalized !== "FINALIZED") {
    throw new SemesterArchiveServiceError(
      "INVALID_INPUT",
      'status must be either "DRAFT" or "FINALIZED".'
    );
  }

  return normalized;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function buildSemesterSnapshot(
  academicTermId: number,
  programId: number
): Promise<Prisma.InputJsonValue> {
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
    throw new SemesterArchiveServiceError(
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
    throw new SemesterArchiveServiceError(
      "PROGRAM_NOT_FOUND",
      "Program was not found."
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
          master_course_id: true,
          section: true,
          is_cooffered: true,
          primary_offered_course_id: true,
          notes: true,
          master_courses: {
            select: {
              id: true,
              course_code: true,
              course_title: true,
              normalized_title: true,
              credit: true,
              course_type: true,
              level_term: true,
              group_name: true,
              curriculum_key: true,
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
                  batch_code: true,
                  admission_term: true,
                  is_active: true,
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
                },
              },
            },
          },
          faculty_course_selections: {
            orderBy: {
              id: "asc",
            },
            select: {
              id: true,
              teacher_id: true,
              academic_term_id: true,
              priority_order: true,
              status: true,
              selected_at: true,
              updated_at: true,
              confirmed_at: true,
              teachers: {
                select: {
                  id: true,
                  teacher_code: true,
                  full_name: true,
                  designation: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const snapshot = {
    schema: "semester-archive-v1",
    generatedAt: new Date().toISOString(),
    academicTerm,
    program,
    offeringCount: offerings.length,
    offerings,
  };

  return toPrismaJson(snapshot);
}

export async function listSemesterArchives(
  input: ListSemesterArchivesInput = {}
) {
  const academicTermId =
    input.academicTermId == null
      ? undefined
      : requirePositiveInteger(input.academicTermId, "academicTermId");

  const programId =
    input.programId == null
      ? undefined
      : requirePositiveInteger(input.programId, "programId");

  const status = normalizeArchiveStatus(input.status);

  return prisma.semester_archives.findMany({
    where: {
      academic_term_id: academicTermId,
      program_id: programId,
      status,
    },
    orderBy: [
      {
        academic_term_id: "desc",
      },
      {
        program_id: "asc",
      },
      {
        version: "desc",
      },
    ],
    select: {
      id: true,
      academic_term_id: true,
      program_id: true,
      version: true,
      status: true,
      snapshot_schema: true,
      archive_note: true,
      created_by_user_id: true,
      created_at: true,
      finalized_by_user_id: true,
      finalized_at: true,
      academic_terms: {
        select: {
          id: true,
          name: true,
          year: true,
          term_type: true,
          is_current: true,
        },
      },
      programs: {
        select: {
          id: true,
          name: true,
          short_name: true,
        },
      },
      created_by_user: {
        select: {
          id: true,
          username: true,
          full_name: true,
          role: true,
        },
      },
      finalized_by_user: {
        select: {
          id: true,
          username: true,
          full_name: true,
          role: true,
        },
      },
      _count: {
        select: {
          reflections: true,
        },
      },
    },
  });
}

export async function getSemesterArchiveById(id: number) {
  const archiveId = requirePositiveInteger(id, "archiveId");

  const archive = await prisma.semester_archives.findUnique({
    where: {
      id: archiveId,
    },
    include: {
      academic_terms: true,
      programs: true,
      created_by_user: {
        select: {
          id: true,
          username: true,
          full_name: true,
          role: true,
        },
      },
      finalized_by_user: {
        select: {
          id: true,
          username: true,
          full_name: true,
          role: true,
        },
      },
      reflections: {
        orderBy: [
          {
            sort_order: "asc",
          },
          {
            id: "asc",
          },
        ],
        include: {
          created_by_user: {
            select: {
              id: true,
              username: true,
              full_name: true,
              role: true,
            },
          },
          updated_by_user: {
            select: {
              id: true,
              username: true,
              full_name: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!archive) {
    throw new SemesterArchiveServiceError(
      "ARCHIVE_NOT_FOUND",
      "Semester archive was not found."
    );
  }

  return archive;
}

export async function createSemesterArchiveDraft(
  input: CreateSemesterArchiveDraftInput
) {
  const academicTermId = requirePositiveInteger(
    input.academicTermId,
    "academicTermId"
  );

  const programId = requirePositiveInteger(input.programId, "programId");

  const createdByUserId = requirePositiveInteger(
    input.createdByUserId,
    "createdByUserId"
  );

  const archiveNote =
    typeof input.archiveNote === "string"
      ? input.archiveNote.trim() || null
      : null;

  const snapshotJson = await buildSemesterSnapshot(
    academicTermId,
    programId
  );

  const latestArchive = await prisma.semester_archives.findFirst({
    where: {
      academic_term_id: academicTermId,
      program_id: programId,
    },
    orderBy: {
      version: "desc",
    },
    select: {
      version: true,
    },
  });

  const nextVersion = (latestArchive?.version ?? 0) + 1;

  try {
    return await prisma.semester_archives.create({
      data: {
        academic_term_id: academicTermId,
        program_id: programId,
        version: nextVersion,
        status: "DRAFT",
        snapshot_json: snapshotJson,
        snapshot_schema: "semester-archive-v1",
        archive_note: archiveNote,
        created_by_user_id: createdByUserId,
      },
      select: {
        id: true,
        academic_term_id: true,
        program_id: true,
        version: true,
        status: true,
        snapshot_schema: true,
        archive_note: true,
        created_by_user_id: true,
        created_at: true,
        finalized_by_user_id: true,
        finalized_at: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new SemesterArchiveServiceError(
        "ARCHIVE_CREATE_CONFLICT",
        "Another archive version was created at the same time. Please retry."
      );
    }

    throw error;
  }
}

export async function finalizeSemesterArchive(
  id: number,
  finalizedByUserId: number
) {
  const archiveId = requirePositiveInteger(id, "archiveId");

  const finalizerId = requirePositiveInteger(
    finalizedByUserId,
    "finalizedByUserId"
  );

  const result = await prisma.semester_archives.updateMany({
    where: {
      id: archiveId,
      status: "DRAFT",
    },
    data: {
      status: "FINALIZED",
      finalized_by_user_id: finalizerId,
      finalized_at: new Date(),
    },
  });

  if (result.count === 0) {
    const existing = await prisma.semester_archives.findUnique({
      where: {
        id: archiveId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      throw new SemesterArchiveServiceError(
        "ARCHIVE_NOT_FOUND",
        "Semester archive was not found."
      );
    }

    if (existing.status === "FINALIZED") {
      throw new SemesterArchiveServiceError(
        "ARCHIVE_ALREADY_FINALIZED",
        "Semester archive is already finalized."
      );
    }

    throw new SemesterArchiveServiceError(
      "INVALID_INPUT",
      `Semester archive cannot be finalized from status "${existing.status}".`
    );
  }

  return getSemesterArchiveById(archiveId);
}

export function getSemesterArchiveErrorStatus(error: unknown): number {
  if (!(error instanceof SemesterArchiveServiceError)) {
    return 500;
  }

  if (
    error.code === "ACADEMIC_TERM_NOT_FOUND" ||
    error.code === "PROGRAM_NOT_FOUND" ||
    error.code === "ARCHIVE_NOT_FOUND"
  ) {
    return 404;
  }

  if (
    error.code === "ARCHIVE_ALREADY_FINALIZED" ||
    error.code === "ARCHIVE_CREATE_CONFLICT"
  ) {
    return 409;
  }

  return 400;
}
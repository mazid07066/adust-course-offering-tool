import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  requireCoordinatorOrAdminApi,
} from "@/lib/auth-guard";

import {
  getNextTerm,
  normalizeComparableTitle,
} from "@/lib/student-status-parser";

import {
  resolveCanonicalProgram,
} from "@/lib/canonical-program";

import {
  resolveAcademicTermContext,
} from "@/lib/academic-term-context";

import {
  deriveBatchCodeFromAcademicTerm,
  parseAcademicTermName,
} from "@/lib/batch-code";

type RefreshMode =
  | "EXISTING_BATCH"
  | "NEW_INTAKE";

type SaveCompletedCourse = {
  code: string;
  title: string;
  semester: string;
  credits: number;
  grade: string;
};

type SaveOngoingCourse = {
  code: string;
  title: string;
  credits: number;
  section: string | null;
};

type RolloverSnapshot = {
  batchAcademicStatus?: Array<{
    id?: number;
    batch_code?: string;
  }>;
};

export const runtime =
  "nodejs";

function normalizeText(
  value: string
) {
  return String(
    value || ""
  ).trim();
}

function normalizeUpper(
  value: string
) {
  return normalizeText(
    value
  ).toUpperCase();
}

function normalizeRefreshMode(
  value: unknown
): RefreshMode {
  return normalizeUpper(
    String(
      value ||
        "EXISTING_BATCH"
    )
  ) === "NEW_INTAKE"
    ? "NEW_INTAKE"
    : "EXISTING_BATCH";
}

function isNewCurriculum(
  value:
    string | null | undefined
) {
  return (
    normalizeUpper(
      String(value || "")
    ) === "NEW"
  );
}

function numbersClose(
  a: number | null,
  b: number | null,
  tolerance = 0.01
) {
  if (
    a === null ||
    b === null
  ) {
    return false;
  }

  return (
    Math.abs(a - b) <=
    tolerance
  );
}

function dedupeCompletedCourses(
  courses:
    SaveCompletedCourse[]
) {
  const map =
    new Map<
      string,
      SaveCompletedCourse
    >();

  for (
    const course of courses
  ) {
    const code =
      normalizeUpper(
        course.code
      );

    const semester =
      normalizeUpper(
        course.semester
      );

    map.set(
      `${code}||${semester}`,
      {
        code,

        title:
          normalizeText(
            course.title
          ),

        semester,

        credits:
          Number(
            course.credits
          ),

        grade:
          normalizeUpper(
            course.grade ||
              ""
          ),
      }
    );
  }

  return Array.from(
    map.values()
  );
}

function dedupeOngoingCourses(
  courses:
    SaveOngoingCourse[]
) {
  const map =
    new Map<
      string,
      SaveOngoingCourse
    >();

  for (
    const course of courses
  ) {
    const code =
      normalizeUpper(
        course.code
      );

    const section =
      normalizeText(
        course.section ||
          ""
      );

    map.set(
      `${code}||${section}`,
      {
        code,

        title:
          normalizeText(
            course.title
          ),

        credits:
          Number(
            course.credits
          ),

        section:
          section ||
          null,
      }
    );
  }

  return Array.from(
    map.values()
  );
}

function archiveContainsBatch(
  snapshotValue:
    unknown,
  batchId:
    number
) {
  if (
    !snapshotValue ||
    typeof snapshotValue !==
      "object"
  ) {
    return false;
  }

  const snapshot =
    snapshotValue as
      RolloverSnapshot;

  if (
    !Array.isArray(
      snapshot
        .batchAcademicStatus
    )
  ) {
    return false;
  }

  return snapshot
    .batchAcademicStatus
    .some(
      (batch) =>
        batch?.id ===
        batchId
    );
}

export async function POST(
  request: NextRequest
) {
  const guard =
    await requireCoordinatorOrAdminApi();

  if (
    guard instanceof Response
  ) {
    return guard;
  }

  try {
    const body =
      await request.json();

    const refreshMode =
      normalizeRefreshMode(
        body.refreshMode
      );

    const programCode =
      normalizeUpper(
        body.programCode ||
          ""
      );

    const requestedBatchCode =
      normalizeText(
        body.batchCode ||
          ""
      );

    const studentId =
      normalizeText(
        body.studentId ||
          ""
      );

    const latestCompletedTerm =
      body.latestCompletedTerm
        ? normalizeUpper(
            body.latestCompletedTerm
          )
        : null;

    const currentRegistrationTerm =
      body.currentRegistrationTerm
        ? normalizeUpper(
            body.currentRegistrationTerm
          )
        : null;

    const transcriptEarnedCredits =
      body.transcriptEarnedCredits ===
          null ||
      body.transcriptEarnedCredits ===
          undefined
        ? null
        : Number(
            body.transcriptEarnedCredits
          );

    const parsedCompletedCredits =
      body.parsedCompletedCredits ===
          null ||
      body.parsedCompletedCredits ===
          undefined
        ? null
        : Number(
            body.parsedCompletedCredits
          );

    const completedCourses =
      dedupeCompletedCourses(
        Array.isArray(
          body.completedCourses
        )
          ? body
              .completedCourses as
              SaveCompletedCourse[]
          : []
      );

    const ongoingCourses =
      dedupeOngoingCourses(
        Array.isArray(
          body.ongoingCourses
        )
          ? body
              .ongoingCourses as
              SaveOngoingCourse[]
          : []
      );

    if (!programCode) {
      return NextResponse.json(
        {
          error:
            "Program code is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      transcriptEarnedCredits !==
        null &&
      parsedCompletedCredits !==
        null &&
      !numbersClose(
        transcriptEarnedCredits,
        parsedCompletedCredits
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Transcript earned credits (${transcriptEarnedCredits}) do not match parsed completed credits (${parsedCompletedCredits}).`,
        },
        {
          status: 400,
        }
      );
    }

    const currentAcademicTerm =
      await resolveAcademicTermContext();

    const generatedBatchCode =
      deriveBatchCodeFromAcademicTerm(
        currentAcademicTerm.name
      );

    const academicIdentity =
      await prisma
        .academic_catalog_entries
        .findFirst({
          where: {
            program_code:
              programCode,

            is_active:
              true,
          },
        });

    if (
      !academicIdentity
    ) {
      return NextResponse.json(
        {
          error:
            "Academic identity not found.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * S2-B3A hard protection.
     *
     * Perform this check before resolveCanonicalProgram()
     * so an invalid OLD new-intake request cannot cause
     * any canonical-program synchronization write.
     */
    if (
      refreshMode ===
        "NEW_INTAKE" &&
      !isNewCurriculum(
        academicIdentity
          .curriculum_version
      )
    ) {
      return NextResponse.json(
        {
          error:
            `${academicIdentity.program_code} uses curriculum version ${academicIdentity.curriculum_version}. New incoming batches may only use a NEW curriculum identity.`,
        },
        {
          status: 409,
        }
      );
    }

    const program =
      await resolveCanonicalProgram({
        department_code:
          academicIdentity
            .department_code,

        department_name:
          academicIdentity
            .department_name,

        program_code:
          academicIdentity
            .program_code,

        program_title:
          academicIdentity
            .program_title,

        study_shift:
          academicIdentity
            .study_shift,
      });

    // ================================================================
    // NEW INTAKE
    // ================================================================

    if (
      refreshMode ===
      "NEW_INTAKE"
    ) {
      if (
        requestedBatchCode &&
        requestedBatchCode !==
          generatedBatchCode
      ) {
        return NextResponse.json(
          {
            error:
              `Expected incoming batch ${generatedBatchCode} for ${currentAcademicTerm.name}.`,
          },
          {
            status: 409,
          }
        );
      }

      if (
        completedCourses.length >
          0 ||
        ongoingCourses.length >
          0 ||
        latestCompletedTerm ||
        currentRegistrationTerm ||
        studentId
      ) {
        return NextResponse.json(
          {
            error:
              "NEW_INTAKE must not contain transcript, registration, or student-history data.",
          },
          {
            status: 400,
          }
        );
      }

      const existingBatch =
        await prisma
          .batches
          .findUnique({
            where: {
              program_id_batch_code: {
                program_id:
                  program.id,

                batch_code:
                  generatedBatchCode,
              },
            },
          });

      if (existingBatch) {
        return NextResponse.json(
          {
            error:
              `Batch ${generatedBatchCode} already exists for this program.`,
          },
          {
            status: 409,
          }
        );
      }

      const activeCourseCount =
        academicIdentity
          .curriculum_key
          ? await prisma
              .master_courses
              .count({
                where: {
                  curriculum_key:
                    academicIdentity
                      .curriculum_key,

                  is_active:
                    true,
                },
              })
          : await prisma
              .master_courses
              .count({
                where: {
                  program_id:
                    program.id,

                  is_active:
                    true,
                },
              });

      if (
        activeCourseCount <=
        0
      ) {
        return NextResponse.json(
          {
            error:
              "No active curriculum courses are available for this new intake.",
          },
          {
            status: 409,
          }
        );
      }

      const createdBatch =
        await prisma
          .batches
          .create({
            data: {
              program_id:
                program.id,

              batch_code:
                generatedBatchCode,

              admission_term:
                currentAcademicTerm
                  .name,

              is_active:
                true,
            },
          });

      return NextResponse.json({
        success: true,

        message:
          `New intake batch ${generatedBatchCode} created for ${currentAcademicTerm.name}.`,

        refreshMode,

        currentAcademicTerm:
          currentAcademicTerm
            .name,

        batchId:
          createdBatch.id,

        batchCode:
          createdBatch
            .batch_code,

        programId:
          program.id,

        admissionTerm:
          createdBatch
            .admission_term,

        savedCompleted:
          0,

        savedOngoing:
          0,

        offeringCandidateSource:
          "FULL_CURRICULUM_NEW_INTAKE",

        curriculumCourseCount:
          activeCourseCount,
      });
    }

    // ================================================================
    // EXISTING BATCH
    // ================================================================

    const batchCode =
      requestedBatchCode;

    if (!batchCode) {
      return NextResponse.json(
        {
          error:
            "Batch code is required for existing-batch refresh.",
        },
        {
          status: 400,
        }
      );
    }

    const existingBatch =
      await prisma
        .batches
        .findUnique({
          where: {
            program_id_batch_code: {
              program_id:
                program.id,

              batch_code:
                batchCode,
            },
          },
        });

    if (!existingBatch) {
      return NextResponse.json(
        {
          error:
            `Batch ${batchCode} does not exist.`,
        },
        {
          status: 404,
        }
      );
    }

    if (
      !latestCompletedTerm ||
      !currentRegistrationTerm
    ) {
      return NextResponse.json(
        {
          error:
            "Existing-batch refresh requires both completed-term and registration-term information.",
        },
        {
          status: 400,
        }
      );
    }

    const nextTerm =
      getNextTerm(
        currentRegistrationTerm
      );

    if (
      nextTerm !==
      currentAcademicTerm.name
    ) {
      return NextResponse.json(
        {
          error:
            `${currentRegistrationTerm} implies ${nextTerm || "UNKNOWN"}, not current term ${currentAcademicTerm.name}.`,
        },
        {
          status: 409,
        }
      );
    }

    const finalizedArchives =
      await prisma
        .semester_archives
        .findMany({
          where: {
            status:
              "FINALIZED",

            snapshot_schema:
              "semester-rollover-v1",

            academic_terms: {
              name:
                currentRegistrationTerm,
            },
          },

          select: {
            id: true,
            snapshot_json: true,
          },
        });

    const protectedByArchive =
      finalizedArchives.some(
        (archive) =>
          archiveContainsBatch(
            archive.snapshot_json,
            existingBatch.id
          )
      );

    if (
      !protectedByArchive
    ) {
      return NextResponse.json(
        {
          error:
            `Batch ${batchCode} cannot be refreshed because its ${currentRegistrationTerm} state is not protected by a finalized rollover archive.`,
        },
        {
          status: 409,
        }
      );
    }

    const saveResult =
      await prisma
        .$transaction(
          async (tx) => {
            const batch =
              await tx
                .batches
                .update({
                  where: {
                    id:
                      existingBatch.id,
                  },

                  data: {
                    is_active:
                      true,
                  },
                });

            const completedTermMap =
              new Map<
                string,
                number
              >();

            const distinctCompletedTerms =
              Array.from(
                new Set(
                  completedCourses
                    .map(
                      (course) =>
                        normalizeUpper(
                          course.semester
                        )
                    )
                    .filter(Boolean)
                )
              );

            for (
              const termName of
              distinctCompletedTerms
            ) {
              const parsedTerm =
                parseAcademicTermName(
                  termName
                );

              const term =
                await tx
                  .academic_terms
                  .upsert({
                    where: {
                      name:
                        parsedTerm.name,
                    },

                    update: {},

                    create: {
                      name:
                        parsedTerm.name,

                      term_type:
                        parsedTerm.termType,

                      year:
                        parsedTerm.year,

                      is_active:
                        true,

                      is_current:
                        false,
                    },
                  });

              completedTermMap.set(
                parsedTerm.name,
                term.id
              );
            }

            const registrationParsedTerm =
              parseAcademicTermName(
                currentRegistrationTerm
              );

            const registrationTerm =
              await tx
                .academic_terms
                .upsert({
                  where: {
                    name:
                      registrationParsedTerm
                        .name,
                  },

                  update: {},

                  create: {
                    name:
                      registrationParsedTerm
                        .name,

                    term_type:
                      registrationParsedTerm
                        .termType,

                    year:
                      registrationParsedTerm
                        .year,

                    is_active:
                      true,

                    is_current:
                      false,
                  },
                });

            await tx
              .batch_completed_courses
              .deleteMany({
                where: {
                  batch_id:
                    batch.id,
                },
              });

            await tx
              .batch_current_registrations
              .deleteMany({
                where: {
                  batch_id:
                    batch.id,
                },
              });

            if (
              completedCourses.length >
              0
            ) {
              await tx
                .batch_completed_courses
                .createMany({
                  data:
                    completedCourses.map(
                      (course) => {
                        const termName =
                          normalizeUpper(
                            course.semester
                          );

                        const academicTermId =
                          completedTermMap.get(
                            termName
                          );

                        if (
                          !academicTermId
                        ) {
                          throw new Error(
                            `Missing academic-term mapping for ${course.code}.`
                          );
                        }

                        return {
                          batch_id:
                            batch.id,

                          academic_term_id:
                            academicTermId,

                          course_code:
                            normalizeUpper(
                              course.code
                            ),

                          course_title:
                            normalizeText(
                              course.title
                            ),

                          normalized_title:
                            normalizeComparableTitle(
                              course.title
                            ),

                          credit:
                            Number(
                              course.credits
                            ),

                          grade:
                            normalizeUpper(
                              course.grade ||
                                ""
                            ) ||
                            null,

                          source_student_id:
                            studentId ||
                            null,

                          source_file_name:
                            null,
                        };
                      }
                    ),
                });
            }

            if (
              ongoingCourses.length >
              0
            ) {
              await tx
                .batch_current_registrations
                .createMany({
                  data:
                    ongoingCourses.map(
                      (course) => ({
                        batch_id:
                          batch.id,

                        academic_term_id:
                          registrationTerm.id,

                        course_code:
                          normalizeUpper(
                            course.code
                          ),

                        course_title:
                          normalizeText(
                            course.title
                          ),

                        normalized_title:
                          normalizeComparableTitle(
                            course.title
                          ),

                        credit:
                          Number(
                            course.credits
                          ),

                        source_student_id:
                          studentId ||
                          null,

                        source_file_name:
                          null,
                      })
                    ),
                });
            }

            return {
              batch,
            };
          }
        );

    const savedCompleted =
      await prisma
        .batch_completed_courses
        .count({
          where: {
            batch_id:
              saveResult.batch.id,
          },
        });

    const savedOngoing =
      await prisma
        .batch_current_registrations
        .count({
          where: {
            batch_id:
              saveResult.batch.id,
          },
        });

    return NextResponse.json({
      success: true,

      message:
        `Existing batch ${batchCode} refreshed for ${currentAcademicTerm.name}.`,

      refreshMode,

      currentAcademicTerm:
        currentAcademicTerm
          .name,

      batchId:
        saveResult.batch.id,

      batchCode:
        saveResult.batch
          .batch_code,

      programId:
        program.id,

      admissionTerm:
        saveResult.batch
          .admission_term,

      savedCompleted,

      savedOngoing,

      offeringCandidateSource:
        "REMAINING_CURRICULUM",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save batch status.",
      },
      {
        status: 500,
      }
    );
  }
}
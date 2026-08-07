import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  requireCoordinatorOrAdminApi,
} from "@/lib/auth-guard";

import {
  findCanonicalProgram,
} from "@/lib/canonical-program";

import {
  resolveAcademicTermContext,
} from "@/lib/academic-term-context";

import {
  buildStudentIdPattern,
  deriveBatchCodeFromAcademicTerm,
} from "@/lib/batch-code";

import {
  compareTerms,
  extractPdfText,
  extractPdfTextVariants,
  getCompletedCourseMap,
  getFailedOnlyCodes,
  getLatestTerm,
  getNextTerm,
  makeDebugTextSample,
  normalizeComparableCourseCode,
  normalizeComparableTitle,
  parseRegistrationCourses,
  parseRegistrationSemester,
  parseStudentIdentity,
  parseTranscriptCourses,
  parseTranscriptEarnedCredits,
  sumCourseCredits,
} from "@/lib/student-status-parser";

export const runtime = "nodejs";

type RefreshMode =
  | "EXISTING_BATCH"
  | "NEW_INTAKE";

type CatalogProgramRow = {
  id: number;
  department_code: string;
  department_name: string;
  program_code: string;
  program_title: string;
  program_type: string;
  study_shift: string;
  curriculum_version: string;
  curriculum_key: string | null;
  student_id_suffix: string | null;
  display_label: string;
  is_active: boolean;
};

type ParsedTranscriptCourse = {
  code: string;
  comparableCode: string;
  comparableTitle: string;
  title: string;
  credits: number;
  grade: string;
  semester: string;
};

function normalizeRefreshMode(
  value: FormDataEntryValue | null
): RefreshMode {
  const normalized =
    String(
      value || "EXISTING_BATCH"
    )
      .trim()
      .toUpperCase();

  return normalized ===
    "NEW_INTAKE"
    ? "NEW_INTAKE"
    : "EXISTING_BATCH";
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

function chooseBetterTranscriptParse(
  primaryText: string,
  alternateText: string
) {
  const primaryCourses =
    parseTranscriptCourses(
      primaryText
    );

  const alternateCourses =
    parseTranscriptCourses(
      alternateText
    );

  const primaryCompleted =
    Array.from(
      getCompletedCourseMap(
        primaryCourses
      ).values()
    );

  const alternateCompleted =
    Array.from(
      getCompletedCourseMap(
        alternateCourses
      ).values()
    );

  const primaryEarned =
    parseTranscriptEarnedCredits(
      primaryText
    );

  const alternateEarned =
    parseTranscriptEarnedCredits(
      alternateText
    );

  const primaryCompletedCredits =
    sumCourseCredits(
      primaryCompleted
    );

  const alternateCompletedCredits =
    sumCourseCredits(
      alternateCompleted
    );

  const primaryScore =
    primaryCourses.length * 10 +
    primaryCompleted.length * 5 +
    (
      primaryEarned !== null &&
      numbersClose(
        primaryEarned,
        primaryCompletedCredits
      )
        ? 1000
        : 0
    );

  const alternateScore =
    alternateCourses.length * 10 +
    alternateCompleted.length * 5 +
    (
      alternateEarned !== null &&
      numbersClose(
        alternateEarned,
        alternateCompletedCredits
      )
        ? 1000
        : 0
    );

  if (
    alternateScore >
    primaryScore
  ) {
    return {
      chosenText:
        alternateText,

      transcriptCourses:
        alternateCourses,

      transcriptEarnedCredits:
        alternateEarned,

      chosenSource:
        "alternate",
    };
  }

  return {
    chosenText:
      primaryText,

    transcriptCourses:
      primaryCourses,

    transcriptEarnedCredits:
      primaryEarned,

    chosenSource:
      "primary",
  };
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
    const formData =
      await request.formData();

    const refreshMode =
      normalizeRefreshMode(
        formData.get(
          "refreshMode"
        )
      );

    const selectedProgramCode =
      String(
        formData.get(
          "programCode"
        ) || ""
      )
        .trim()
        .toUpperCase();

    const transcriptValue =
      formData.get(
        "transcriptFile"
      );

    const registrationValue =
      formData.get(
        "registrationFile"
      );

    const transcriptFile =
      transcriptValue &&
      typeof transcriptValue !==
        "string"
        ? transcriptValue
        : null;

    const registrationFile =
      registrationValue &&
      typeof registrationValue !==
        "string"
        ? registrationValue
        : null;

    if (
      !selectedProgramCode
    ) {
      return NextResponse.json(
        {
          error:
            "Program / curriculum selection is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      refreshMode ===
        "EXISTING_BATCH" &&
      (
        !transcriptFile ||
        !registrationFile
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Existing batch refresh requires both the latest transcript PDF and latest registration PDF.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      refreshMode ===
        "NEW_INTAKE" &&
      (
        transcriptFile ||
        registrationFile
      )
    ) {
      return NextResponse.json(
        {
          error:
            "NEW_INTAKE does not use transcript or registration PDFs.",
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

    const selectedProgram =
      (await prisma
        .academic_catalog_entries
        .findFirst({
          where: {
            program_code:
              selectedProgramCode,

            is_active:
              true,
          },
        })) as
        | CatalogProgramRow
        | null;

    if (!selectedProgram) {
      return NextResponse.json(
        {
          error:
            "Selected academic identity was not found in Academic Setup.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * IMPORTANT:
     * Preview must remain read-only.
     *
     * findCanonicalProgram() performs lookup only.
     * It does not create or update departments/programs.
     */
    const canonicalProgram =
      await findCanonicalProgram({
        department_code:
          selectedProgram
            .department_code,

        department_name:
          selectedProgram
            .department_name,

        program_code:
          selectedProgram
            .program_code,

        program_title:
          selectedProgram
            .program_title,

        study_shift:
          selectedProgram
            .study_shift,
      });

    if (!canonicalProgram) {
      return NextResponse.json(
        {
          error:
            "Canonical program mapping is missing. Complete Academic Setup before preparing semester batches.",
        },
        {
          status: 409,
        }
      );
    }

    const masterCourses =
      selectedProgram.curriculum_key
        ? await prisma
            .master_courses
            .findMany({
              where: {
                curriculum_key:
                  selectedProgram
                    .curriculum_key,

                is_active:
                  true,
              },

              orderBy: {
                course_code:
                  "asc",
              },
            })
        : await prisma
            .master_courses
            .findMany({
              where: {
                program_id:
                  canonicalProgram.id,

                is_active:
                  true,
              },

              orderBy: {
                course_code:
                  "asc",
              },
            });

    // ================================================================
    // NEW INTAKE
    // ================================================================

    if (
      refreshMode ===
      "NEW_INTAKE"
    ) {
      const existingBatch =
        await prisma
          .batches
          .findUnique({
            where: {
              program_id_batch_code: {
                program_id:
                  canonicalProgram.id,

                batch_code:
                  generatedBatchCode,
              },
            },

            select: {
              id: true,
              batch_code: true,
              admission_term: true,
              is_active: true,
            },
          });

      const warningMessages:
        string[] = [];

      let rolloverReady =
        true;

      if (existingBatch) {
        rolloverReady =
          false;

        warningMessages.push(
          `Batch ${generatedBatchCode} already exists for this canonical program.`
        );
      }

      if (
        masterCourses.length ===
        0
      ) {
        rolloverReady =
          false;

        warningMessages.push(
          selectedProgram
            .curriculum_key
            ? `No active master courses were found for curriculum key ${selectedProgram.curriculum_key}.`
            : `No active master courses were found for ${selectedProgram.program_code}.`
        );
      }

      const studentIdPattern =
        buildStudentIdPattern(
          generatedBatchCode,
          selectedProgram
            .student_id_suffix
        );

      const offeringCandidateCourses =
        masterCourses.map(
          (course) => ({
            code:
              course.course_code,

            title:
              course.course_title,

            credits:
              course.credit,

            section:
              null,

            source:
              "FULL_CURRICULUM_NEW_INTAKE",
          })
        );

      return NextResponse.json({
        success: true,

        refreshContext: {
          refreshMode,

          currentAcademicTerm:
            currentAcademicTerm.name,

          generatedBatchCode,

          studentIdPattern,

          rolloverReady,

          existingBatchId:
            existingBatch?.id ??
            null,

          existingBatchFound:
            Boolean(
              existingBatch
            ),
        },

        selectedProgram: {
          programCode:
            selectedProgram
              .program_code,

          displayLabel:
            selectedProgram
              .display_label,

          curriculumKey:
            selectedProgram
              .curriculum_key,
        },

        inferredProgram:
          null,

        studentIdentity: {
          studentId:
            null,

          batchCode:
            generatedBatchCode,

          suffix:
            selectedProgram
              .student_id_suffix,
        },

        warningMessages,

        transcriptSummary: {
          parsedCount:
            0,

          latestCompletedTerm:
            null,

          failedOnlyCodes:
            [],

          transcriptEarnedCredits:
            null,

          parsedCompletedCredits:
            0,

          completedCreditMismatch:
            false,

          parserSource:
            "not-required",
        },

        registrationSummary: {
          parsedCount:
            0,

          currentRegistrationTerm:
            null,

          parsedOngoingCredits:
            0,
        },

        offeringContext: {
          suggestedNextOfferingTerm:
            currentAcademicTerm.name,

          offeringCandidateCount:
            offeringCandidateCourses.length,
        },

        counts: {
          completed:
            0,

          ongoing:
            0,

          remaining:
            masterCourses.length,

          masterCourses:
            masterCourses.length,
        },

        creditSummary: {
          transcriptEarnedCredits:
            null,

          parsedCompletedCredits:
            0,

          parsedOngoingCredits:
            0,

          combinedAcademicLoad:
            0,

          completedCreditMismatch:
            false,
        },

        completedCourses:
          [],

        ongoingCourses:
          [],

        remainingCourses:
          masterCourses.map(
            (course) => ({
              code:
                course.course_code,

              title:
                course.course_title,

              credits:
                course.credit,

              type:
                course.course_type,

              group:
                course.group_name,

              levelTerm:
                course.level_term,

              curriculumKey:
                course.curriculum_key,
            })
          ),

        offeringCandidateCourses,

        debug:
          undefined,
      });
    }

    // ================================================================
    // EXISTING BATCH
    // ================================================================

    const transcriptBuffer =
      Buffer.from(
        await transcriptFile!
          .arrayBuffer()
      );

    const transcriptVariants =
      await extractPdfTextVariants(
        transcriptBuffer
      );

    const transcriptChoice =
      chooseBetterTranscriptParse(
        transcriptVariants.primary,
        transcriptVariants.alternate
      );

    const transcriptText =
      transcriptChoice.chosenText;

    const transcriptCourses =
      transcriptChoice
        .transcriptCourses as
          ParsedTranscriptCourse[];

    const transcriptEarnedCredits =
      transcriptChoice
        .transcriptEarnedCredits;

    const transcriptParserSource =
      transcriptChoice
        .chosenSource;

    const registrationText =
      await extractPdfText(
        Buffer.from(
          await registrationFile!
            .arrayBuffer()
        )
      );

    const identitySourceText =
      [
        transcriptText,
        registrationText,
      ]
        .filter(Boolean)
        .join(" ");

    const identity =
      parseStudentIdentity(
        identitySourceText
      );

    const inferredProgram =
      identity.suffix
        ? ((await prisma
            .academic_catalog_entries
            .findFirst({
              where: {
                student_id_suffix:
                  identity.suffix,

                is_active:
                  true,
              },
            })) as
            | CatalogProgramRow
            | null)
        : null;

    const registrationCourses =
      parseRegistrationCourses(
        registrationText
      );

    const completedMap =
      getCompletedCourseMap(
        transcriptCourses
      );

    const ongoingMap =
      new Map(
        registrationCourses.map(
          (course) => [
            course.comparableCode,

            {
              code:
                course.code,

              comparableCode:
                course.comparableCode,

              comparableTitle:
                course.comparableTitle,

              title:
                course.title,

              credits:
                course.credits,

              section:
                course.section,
            },
          ]
        )
      );

    const completedCourses =
      Array.from(
        completedMap.values()
      ).sort(
        (a, b) => {
          const termCompare =
            compareTerms(
              a.semester,
              b.semester
            );

          if (
            termCompare !== 0
          ) {
            return termCompare;
          }

          return a.code.localeCompare(
            b.code
          );
        }
      );

    const ongoingCourses =
      Array.from(
        ongoingMap.values()
      ).sort(
        (a, b) =>
          a.code.localeCompare(
            b.code
          )
      );

    const parsedCompletedCredits =
      sumCourseCredits(
        completedCourses
      );

    const parsedOngoingCredits =
      sumCourseCredits(
        ongoingCourses
      );

    const combinedAcademicLoad =
      Number(
        (
          parsedCompletedCredits +
          parsedOngoingCredits
        ).toFixed(2)
      );

    const completedCreditMismatch =
      transcriptEarnedCredits !==
        null &&
      !numbersClose(
        transcriptEarnedCredits,
        parsedCompletedCredits
      );

    const failedOnlyCodes =
      getFailedOnlyCodes(
        transcriptCourses
      );

    const latestCompletedTerm =
      getLatestTerm(
        Array.from(
          completedMap.values()
        ).map(
          (row) =>
            row.semester
        )
      );

    const currentRegistrationTerm =
      parseRegistrationSemester(
        registrationText
      );

    const calculatedNextTerm =
      getNextTerm(
        currentRegistrationTerm ||
          latestCompletedTerm ||
          null
      );

    const completedComparableCodes =
      new Set(
        Array.from(
          completedMap.values()
        ).map(
          (row) =>
            row.comparableCode
        )
      );

    const completedComparableTitles =
      new Set(
        Array.from(
          completedMap.values()
        )
          .map(
            (row) =>
              row.comparableTitle
          )
          .filter(Boolean)
      );

    const ongoingComparableCodes =
      new Set(
        Array.from(
          ongoingMap.values()
        ).map(
          (row) =>
            row.comparableCode
        )
      );

    const ongoingComparableTitles =
      new Set(
        Array.from(
          ongoingMap.values()
        )
          .map(
            (row) =>
              row.comparableTitle
          )
          .filter(Boolean)
      );

    const remainingCourses =
      masterCourses.filter(
        (course) => {
          const comparableCode =
            normalizeComparableCourseCode(
              course.course_code
            );

          const comparableTitle =
            normalizeComparableTitle(
              course.course_title
            );

          const matchedCompleted =
            completedComparableCodes
              .has(
                comparableCode
              ) ||
            (
              !comparableCode &&
              Boolean(
                comparableTitle
              ) &&
              completedComparableTitles
                .has(
                  comparableTitle
                )
            );

          const matchedOngoing =
            ongoingComparableCodes
              .has(
                comparableCode
              ) ||
            (
              !comparableCode &&
              Boolean(
                comparableTitle
              ) &&
              ongoingComparableTitles
                .has(
                  comparableTitle
                )
            );

          return (
            !matchedCompleted &&
            !matchedOngoing
          );
        }
      );

    const existingBatch =
      identity.batchCode
        ? await prisma
            .batches
            .findUnique({
              where: {
                program_id_batch_code: {
                  program_id:
                    canonicalProgram.id,

                  batch_code:
                    identity.batchCode,
                },
              },

              select: {
                id: true,
                batch_code: true,
                admission_term: true,
                is_active: true,
              },
            })
        : null;

    const warningMessages:
      string[] = [];

    if (
      identity.studentId &&
      inferredProgram &&
      inferredProgram
        .program_code !==
        selectedProgram
          .program_code
    ) {
      warningMessages.push(
        `Selected academic identity (${selectedProgram.program_code}) does not match student ID suffix inference (${inferredProgram.program_code}).`
      );
    }

    if (
      !identity.studentId
    ) {
      warningMessages.push(
        "Student ID could not be detected."
      );
    }

    if (
      !identity.batchCode
    ) {
      warningMessages.push(
        "Batch code could not be detected."
      );
    }

    if (
      !masterCourses.length
    ) {
      warningMessages.push(
        "No active master courses were found."
      );
    }

    if (
      transcriptEarnedCredits ===
        null
    ) {
      warningMessages.push(
        "Transcript earned-credit total could not be detected."
      );
    }

    if (
      completedCreditMismatch
    ) {
      warningMessages.push(
        `Transcript earned credits (${transcriptEarnedCredits}) do not match parsed completed credits (${parsedCompletedCredits}).`
      );
    }

    let rolloverReady =
      true;

    if (!existingBatch) {
      rolloverReady =
        false;

      warningMessages.push(
        "Existing batch could not be resolved."
      );
    }

    if (
      !currentRegistrationTerm
    ) {
      rolloverReady =
        false;

      warningMessages.push(
        "Registration semester could not be detected."
      );
    }

    if (
      calculatedNextTerm !==
      currentAcademicTerm.name
    ) {
      rolloverReady =
        false;

      warningMessages.push(
        `Uploaded records imply ${calculatedNextTerm || "UNKNOWN"}, but current UniFlow term is ${currentAcademicTerm.name}.`
      );
    }

    const offeringCandidateCourses =
      remainingCourses.map(
        (course) => ({
          code:
            course.course_code,

          title:
            course.course_title,

          credits:
            course.credit,

          section:
            null,

          source:
            "REMAINING_CURRICULUM",
        })
      );

    return NextResponse.json({
      success: true,

      refreshContext: {
        refreshMode,

        currentAcademicTerm:
          currentAcademicTerm.name,

        generatedBatchCode,

        studentIdPattern:
          null,

        rolloverReady,

        existingBatchId:
          existingBatch?.id ??
          null,

        existingBatchFound:
          Boolean(
            existingBatch
          ),
      },

      selectedProgram: {
        programCode:
          selectedProgram
            .program_code,

        displayLabel:
          selectedProgram
            .display_label,

        curriculumKey:
          selectedProgram
            .curriculum_key,
      },

      inferredProgram:
        inferredProgram
          ? {
              programCode:
                inferredProgram
                  .program_code,

              displayLabel:
                inferredProgram
                  .display_label,

              curriculumKey:
                inferredProgram
                  .curriculum_key,
            }
          : null,

      studentIdentity:
        identity,

      warningMessages,

      transcriptSummary: {
        parsedCount:
          transcriptCourses.length,

        latestCompletedTerm,

        failedOnlyCodes,

        transcriptEarnedCredits,

        parsedCompletedCredits,

        completedCreditMismatch,

        parserSource:
          transcriptParserSource,
      },

      registrationSummary: {
        parsedCount:
          registrationCourses.length,

        currentRegistrationTerm,

        parsedOngoingCredits,
      },

      offeringContext: {
        suggestedNextOfferingTerm:
          calculatedNextTerm,

        offeringCandidateCount:
          offeringCandidateCourses.length,
      },

      counts: {
        completed:
          completedMap.size,

        ongoing:
          ongoingMap.size,

        remaining:
          remainingCourses.length,

        masterCourses:
          masterCourses.length,
      },

      creditSummary: {
        transcriptEarnedCredits,

        parsedCompletedCredits,

        parsedOngoingCredits,

        combinedAcademicLoad,

        completedCreditMismatch,
      },

      completedCourses,

      ongoingCourses,

      remainingCourses:
        remainingCourses.map(
          (course) => ({
            code:
              course.course_code,

            title:
              course.course_title,

            credits:
              course.credit,

            type:
              course.course_type,

            group:
              course.group_name,

            levelTerm:
              course.level_term,

            curriculumKey:
              course.curriculum_key,
          })
        ),

      offeringCandidateCourses,

      debug: {
        transcriptTextSample:
          makeDebugTextSample(
            transcriptText
          ),

        registrationTextSample:
          makeDebugTextSample(
            registrationText
          ),
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Student-status preview failed.",
      },
      {
        status: 500,
      }
    );
  }
}
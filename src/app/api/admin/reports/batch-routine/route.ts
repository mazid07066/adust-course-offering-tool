import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getScheduleRowsForReporting } from "@/lib/reporting-data";
import { uniqueStrings } from "@/lib/report-visible-statuses";

type ViewMode =
  | "DRAFT"
  | "FINAL"
  | "ALL";

type ProgramOption = {
  value: string;
  label: string;
  reportProgramCodes: string[];
};

function clean(
  value: string | null | undefined
) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function compact(
  value: string | null | undefined
) {
  return clean(value)
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeViewMode(
  value: string | null
): ViewMode {
  const normalized =
    clean(value || "DRAFT");

  if (normalized === "FINAL") {
    return "FINAL";
  }

  if (normalized === "ALL") {
    return "ALL";
  }

  return "DRAFT";
}

function getStatusesForViewMode(
  viewMode: ViewMode
) {
  if (viewMode === "FINAL") {
    return [
      "FACULTY_CHOICE_BUFFER",
      "FACULTY_CHOICE_FINALIZED",
      "CONFIRMED",
    ];
  }

  if (viewMode === "ALL") {
    return [
      "DRAFT",
      "BUFFER_READY",
      "FACULTY_CHOICE_BUFFER",
      "FACULTY_CHOICE_FINALIZED",
      "CONFIRMED",
    ];
  }

  return [
    "DRAFT",
    "BUFFER_READY",
  ];
}

function detectIdentityGroup(
  values: Array<
    string | null | undefined
  >
) {
  const text =
    values
      .map(compact)
      .join(" ");

  const isEEE =
    text.includes("EEE");

  const isRAE =
    text.includes("RAE") ||
    text.includes(
      "ROBOTICSANDAUTOMATION"
    );

  const isEvening =
    text.includes("EVE") ||
    text.includes("EVENING");

  const isRegular =
    text.includes("REG") ||
    text.includes("REGULAR");

  const isNew =
    text.includes("NEW");

  const isOld =
    text.includes("OLD");

  return {
    isEEE,
    isRAE,
    isEvening,
    isRegular,
    isNew,
    isOld,
  };
}

function identitiesMatch(
  catalog: {
    program_code: string;
    program_title: string;
    study_shift: string;
    curriculum_version: string;
    display_label: string;
  },
  reportProgramCode: string
) {
  const catalogIdentity =
    detectIdentityGroup([
      catalog.program_code,
      catalog.program_title,
      catalog.study_shift,
      catalog.curriculum_version,
      catalog.display_label,
    ]);

  const reportIdentity =
    detectIdentityGroup([
      reportProgramCode,
    ]);

  if (
    catalogIdentity.isEEE !==
    reportIdentity.isEEE
  ) {
    return false;
  }

  if (
    catalogIdentity.isRAE !==
    reportIdentity.isRAE
  ) {
    return false;
  }

  if (
    catalogIdentity.isEvening &&
    !reportIdentity.isEvening
  ) {
    return false;
  }

  if (
    catalogIdentity.isRegular &&
    !reportIdentity.isRegular
  ) {
    return false;
  }

  /*
   * RAE currently uses one canonical operational/master
   * program identity for both curriculum variants.
   * Therefore NEW/OLD must not be used to reject RAE rows.
   */
  if (!catalogIdentity.isRAE) {
    if (
      catalogIdentity.isNew &&
      reportIdentity.isOld
    ) {
      return false;
    }

    if (
      catalogIdentity.isOld &&
      reportIdentity.isNew
    ) {
      return false;
    }
  }

  return (
    catalogIdentity.isEEE ||
    catalogIdentity.isRAE
  );
}

export async function GET(
  req: NextRequest
) {
  const guard =
    await requireCoordinatorOrAdminApi();

  if (
    guard instanceof Response
  ) {
    return guard;
  }

  try {
    const { searchParams } =
      new URL(req.url);

    const termName =
      String(
        searchParams.get(
          "termName"
        ) || ""
      ).trim();

    const batchCode =
      clean(
        searchParams.get(
          "batchCode"
        )
      );

    const selectedAcademicProgramCode =
      clean(
        searchParams.get(
          "programCode"
        )
      );

    const scheduleKind =
      clean(
        searchParams.get(
          "scheduleKind"
        ) || "ALL"
      );

    const viewMode =
      normalizeViewMode(
        searchParams.get(
          "viewMode"
        )
      );

    if (!termName) {
      return NextResponse.json(
        {
          error:
            "termName is required.",
        },
        {
          status: 400,
        }
      );
    }

    const statuses =
      getStatusesForViewMode(
        viewMode
      );

    /*
     * Do not filter by program inside reporting-data.
     *
     * Reporting rows may use curriculum/master program
     * identities while offerings use canonical operational
     * identities.
     */
    const rows =
      await getScheduleRowsForReporting({
        termName,

        batchCode:
          batchCode ||
          undefined,

        scheduleKind:
          scheduleKind ===
            "CLASS" ||
          scheduleKind ===
            "LAB" ||
          scheduleKind ===
            "PROJECT"
            ? scheduleKind
            : "ALL",

        statuses,
      });

    /*
     * Program offering credit/load summary must always represent
     * the complete academic offering composition.
     *
     * Therefore it follows:
     * - academic term
     * - view/status
     * - selected batch
     * - selected academic program
     *
     * but deliberately ignores the Schedule Type filter.
     */
    const summarySourceRows =
      scheduleKind === "ALL"
        ? rows
        : await getScheduleRowsForReporting({
            termName,

            batchCode:
              batchCode ||
              undefined,

            scheduleKind:
              "ALL",

            statuses,
          });
    const catalogRows =
      await prisma
        .academic_catalog_entries
        .findMany({
          where: {
            is_active: true,
          },

          select: {
            program_code:
              true,

            program_title:
              true,

            study_shift:
              true,

            curriculum_version:
              true,

            display_label:
              true,
          },

          orderBy: [
            {
              department_code:
                "asc",
            },
            {
              program_title:
                "asc",
            },
            {
              study_shift:
                "asc",
            },
            {
              curriculum_version:
                "asc",
            },
          ],
        });

    const reportProgramCodes =
      uniqueStrings(
        rows.map(
          (row) =>
            row.programCode
        )
      ).sort();

    const programOptions:
      ProgramOption[] =
      catalogRows
        .map(
          (catalog) => {
            const matches =
              reportProgramCodes.filter(
                (
                  reportProgramCode
                ) =>
                  identitiesMatch(
                    catalog,
                    reportProgramCode
                  )
              );

            return {
              value:
                catalog.program_code,

              label:
                catalog.display_label ||
                [
                  catalog.program_title,
                  catalog.study_shift,
                  catalog.curriculum_version,
                ]
                  .filter(Boolean)
                  .join(" | "),

              reportProgramCodes:
                matches,
            };
          }
        )
        .filter(
          (option) =>
            option
              .reportProgramCodes
              .length > 0
        );

    let selectedReportProgramCodes:
      string[] = [];

    if (
      selectedAcademicProgramCode
    ) {
      const selectedOption =
        programOptions.find(
          (option) =>
            clean(
              option.value
            ) ===
            selectedAcademicProgramCode
        );

      selectedReportProgramCodes =
        selectedOption
          ?.reportProgramCodes ||
        [];
    }

    const filteredRows =
      rows.filter(
        (row) => {
          if (
            batchCode &&
            !row.batchCodes.some(
              (value) =>
                clean(value) ===
                batchCode
            )
          ) {
            return false;
          }

          if (
            selectedAcademicProgramCode
          ) {
            if (
              selectedReportProgramCodes
                .length === 0
            ) {
              return false;
            }

            if (
              !selectedReportProgramCodes.some(
                (code) =>
                  clean(code) ===
                  clean(
                    row.programCode
                  )
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );

    const academicLabelForRow = (
      reportProgramCode: string
    ) => {
      const matchingOption =
        programOptions.find(
          (option) =>
            option
              .reportProgramCodes
              .some(
                (code) =>
                  clean(code) ===
                  clean(
                    reportProgramCode
                  )
              )
        );

      return (
        matchingOption?.label ||
        reportProgramCode
      );
    };

    /*
     * Apply the same academic program/batch identity filters used
     * by the visible report, but keep all schedule kinds so that
     * theory/lab/project totals remain complete.
     */
    const summaryFilteredRows =
      summarySourceRows.filter(
        (row) => {
          if (
            batchCode &&
            !row.batchCodes.some(
              (value) =>
                clean(value) ===
                batchCode
            )
          ) {
            return false;
          }

          if (
            selectedAcademicProgramCode
          ) {
            if (
              selectedReportProgramCodes
                .length === 0
            ) {
              return false;
            }

            if (
              !selectedReportProgramCodes.some(
                (code) =>
                  clean(code) ===
                  clean(
                    row.programCode
                  )
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );

    /*
     * A course with several weekly slots produces several schedule
     * rows. Credits and course counts must be counted once per
     * offeredCourseId, never once per slot.
     */
    const uniqueSummaryCourses =
      new Map<
        number,
        (typeof summaryFilteredRows)[number]
      >();

    for (
      const row of
      summaryFilteredRows
    ) {
      if (
        !uniqueSummaryCourses.has(
          row.offeredCourseId
        )
      ) {
        uniqueSummaryCourses.set(
          row.offeredCourseId,
          row
        );
      }
    }

    type ProgramOfferingAccumulator = {
      programCode: string;
      programLabel: string;

      totalCourses: number;
      totalCredits: number;

      theoryCourses: number;
      theoryCredits: number;

      labCourses: number;
      labCredits: number;

      projectCourses: number;
      projectCredits: number;

      primaryCourses: number;
      secondaryCourses: number;
    };

    const programSummaryMap =
      new Map<
        string,
        ProgramOfferingAccumulator
      >();

    for (
      const course of
      uniqueSummaryCourses.values()
    ) {
      const key =
        clean(
          course.programCode
        );

      let item =
        programSummaryMap.get(
          key
        );

      if (!item) {
        item = {
          programCode:
            course.programCode,

          programLabel:
            academicLabelForRow(
              course.programCode
            ),

          totalCourses: 0,
          totalCredits: 0,

          theoryCourses: 0,
          theoryCredits: 0,

          labCourses: 0,
          labCredits: 0,

          projectCourses: 0,
          projectCredits: 0,

          primaryCourses: 0,
          secondaryCourses: 0,
        };

        programSummaryMap.set(
          key,
          item
        );
      }

      const credit =
        Number(
          course.credit || 0
        );

      item.totalCourses += 1;
      item.totalCredits += credit;

      if (
        course.role ===
        "SECONDARY"
      ) {
        item.secondaryCourses += 1;
      } else {
        item.primaryCourses += 1;
      }

      if (
        course.scheduleKind ===
        "LAB"
      ) {
        item.labCourses += 1;
        item.labCredits += credit;
      } else if (
        course.scheduleKind ===
        "PROJECT"
      ) {
        item.projectCourses += 1;
        item.projectCredits += credit;
      } else {
        item.theoryCourses += 1;
        item.theoryCredits += credit;
      }
    }

    const programOfferingSummary =
      [...programSummaryMap.values()]
        .map((item) => ({
          ...item,

          totalCredits:
            Number(
              item.totalCredits.toFixed(
                2
              )
            ),

          theoryCredits:
            Number(
              item.theoryCredits.toFixed(
                2
              )
            ),

          labCredits:
            Number(
              item.labCredits.toFixed(
                2
              )
            ),

          projectCredits:
            Number(
              item.projectCredits.toFixed(
                2
              )
            ),
        }))
        .sort((a, b) =>
          a.programLabel.localeCompare(
            b.programLabel
          )
        );
    const batchOptions =
      uniqueStrings(
        rows.flatMap(
          (row) =>
            row.batchCodes
        )
      ).sort();

    const draftRows =
      filteredRows.filter(
        (row) =>
          row.offeringStatus ===
            "DRAFT" ||
          row.offeringStatus ===
            "BUFFER_READY"
      ).length;

    const finalRows =
      filteredRows.filter(
        (row) =>
          row.offeringStatus ===
            "FACULTY_CHOICE_BUFFER" ||
          row.offeringStatus ===
            "FACULTY_CHOICE_FINALIZED" ||
          row.offeringStatus ===
            "CONFIRMED"
      ).length;

    const coOfferingRows =
      filteredRows.filter(
        (row) =>
          row.role ===
          "SECONDARY"
      ).length;

    return NextResponse.json({
      success: true,

      viewMode,

      statuses,

      batchOptions,

      programOptions:
        programOptions.map(
          (option) => ({
            value:
              option.value,

            label:
              option.label,
          })
        ),

      programOfferingSummary,

      summary: {
        totalRows:
          filteredRows.length,

        totalBatches:
          uniqueStrings(
            filteredRows.flatMap(
              (row) =>
                row.batchCodes
            )
          ).length,

        totalPrograms:
          uniqueStrings(
            filteredRows.map(
              (row) =>
                row.programCode
            )
          ).length,

        draftRows,

        finalRows,

        coOfferingRows,
      },

      rows:
        filteredRows.map(
          (row) => ({
            offeredCourseId:
              row.offeredCourseId,

            offeringId:
              row.offeringId,

            offeringStatus:
              row.offeringStatus,

            batchCode:
              row.batchCodes.join(
                ", "
              ) || "-",

            batchCodes:
              row.batchCodes,

            programCode:
              row.programCode,

            programLabel:
              academicLabelForRow(
                row.programCode
              ),

            courseCode:
              row.courseCode,

            courseTitle:
              row.courseTitle,

            credit:
              row.credit,

            section:
              row.section,

            facultyText:
              row.facultyText,

            dayOfWeek:
              row.dayOfWeek,

            startTime:
              row.startTime,

            endTime:
              row.endTime,

            roomCode:
              row.roomCode,

            role:
              row.role,

            primaryReference:
              row.primaryReference,

            scheduleKind:
              row.scheduleKind,
          })
        ),
    });
  } catch (error) {
    console.error(
      "Batch routine report failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load batch routine report.",
      },
      {
        status: 500,
      }
    );
  }
}

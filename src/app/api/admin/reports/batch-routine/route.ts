import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getScheduleRowsForReporting } from "@/lib/reporting-data";
import { uniqueStrings } from "@/lib/report-visible-statuses";

type ViewMode =
  | "DRAFT"
  | "FINAL"
  | "ALL";

function normalizeViewMode(
  value: string | null
): ViewMode {
  const normalized = String(
    value || "DRAFT"
  )
    .trim()
    .toUpperCase();

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

export async function GET(
  req: NextRequest
) {
  const guard =
    await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const { searchParams } =
      new URL(req.url);

    const termName = String(
      searchParams.get("termName") || ""
    ).trim();

    const batchCode = String(
      searchParams.get("batchCode") || ""
    ).trim();

    const programCode = String(
      searchParams.get("programCode") || ""
    ).trim();

    const scheduleKind = String(
      searchParams.get("scheduleKind") || "ALL"
    )
      .trim()
      .toUpperCase();

    const viewMode =
      normalizeViewMode(
        searchParams.get("viewMode")
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

    const rows =
      await getScheduleRowsForReporting({
        termName,

        programCode:
          programCode ||
          undefined,

        batchCode:
          batchCode ||
          undefined,

        scheduleKind:
          scheduleKind === "CLASS" ||
          scheduleKind === "LAB" ||
          scheduleKind === "PROJECT"
            ? scheduleKind
            : "ALL",

        statuses,
      });

    const allBatchCodes =
      uniqueStrings(
        rows.flatMap(
          (row) =>
            row.batchCodes
        )
      ).sort();

    const programOptions =
      uniqueStrings(
        rows.map(
          (row) =>
            row.programCode
        )
      ).sort();

    const filteredRows =
      batchCode
        ? rows.filter(
            (row) =>
              row.batchCodes.includes(
                batchCode
              )
          )
        : rows;

    const draftCount =
      filteredRows.filter(
        (row) =>
          row.offeringStatus ===
            "DRAFT" ||
          row.offeringStatus ===
            "BUFFER_READY"
      ).length;

    const finalCount =
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

      batchOptions:
        allBatchCodes,

      programOptions,

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

        draftRows:
          draftCount,

        finalRows:
          finalCount,

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

            courseCode:
              row.courseCode,

            courseTitle:
              row.courseTitle,

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

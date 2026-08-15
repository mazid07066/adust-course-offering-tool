import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getScheduleRowsForReporting } from "@/lib/reporting-data";
import {
  createWorkbook,
  setupWorksheet,
  applyHeaderStyle,
  applyDataStyle,
} from "@/lib/reporting-excel";
import {
  DAY_ORDER,
  uniqueStrings,
} from "@/lib/report-visible-statuses";

function safeFileName(value: string) {
  return value
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_");
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const { searchParams } = new URL(req.url);

    const termName = String(
      searchParams.get("termName") || ""
    ).trim();

    const programCode = String(
      searchParams.get("programCode") || ""
    ).trim();

    const batchCode = String(
      searchParams.get("batchCode") || ""
    ).trim();

    const scheduleKind = String(
      searchParams.get("scheduleKind") || "ALL"
    ).trim();

    if (!termName) {
      return NextResponse.json(
        {
          error: "termName is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Reporting-data already handles UniFlow academic /
     * operational program identity matching.
     *
     * Therefore the export consumes the rows returned by the
     * central reporting service and only groups them for Excel.
     */
    const rows = await getScheduleRowsForReporting({
      termName,

      programCode:
        programCode || undefined,

      batchCode:
        batchCode || undefined,

      scheduleKind:
        scheduleKind === "CLASS" ||
        scheduleKind === "LAB" ||
        scheduleKind === "PROJECT"
          ? scheduleKind
          : "ALL",
    });

    const workbook = await createWorkbook();

    /*
     * If a specific batch is selected, export only that batch.
     *
     * If All Batches is selected, every batch returned by the
     * reporting layer is appended vertically in this ONE sheet.
     */
    const availableBatches = uniqueStrings(
      rows.flatMap((row) => row.batchCodes)
    ).sort((a, b) =>
      a.localeCompare(
        b,
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        }
      )
    );

    const targetBatches = batchCode
      ? [batchCode]
      : availableBatches;

    /*
     * One worksheet only.
     *
     * Previously one worksheet was generated for each batch.
     * The Batch-wise Combined Routine now appends all batches
     * sequentially into one professionally formatted worksheet.
     */
    const sheet = setupWorksheet(
      workbook,
      "Batch Combined Routine"
    );

    sheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.2,
        footer: 0.2,
      },
      printTitlesRow: "1:5",
    };

    /*
     * Workbook title.
     */
    sheet.mergeCells("A1:K1");

    sheet.getCell("A1").value =
      "UniFlow Academic Planner";

    sheet.getCell("A1").font = {
      bold: true,
      size: 16,
    };

    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    /*
     * Report title.
     */
    sheet.mergeCells("A2:K2");

    sheet.getCell("A2").value =
      batchCode
        ? `Batch-wise Routine — Batch ${batchCode}`
        : "Batch-wise Combined Routine — All Batches";

    sheet.getCell("A2").font = {
      bold: true,
      size: 14,
    };

    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    /*
     * Report filters.
     */
    sheet.mergeCells("A3:K3");

    sheet.getCell("A3").value =
      `Term: ${termName.toUpperCase()} | ` +
      `Program: ${programCode || "All"} | ` +
      `Batch: ${batchCode || "All Batches"} | ` +
      `Schedule Type: ${scheduleKind || "ALL"}`;

    sheet.getCell("A3").font = {
      italic: true,
      size: 10,
    };

    sheet.getCell("A3").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    /*
     * Blank spacer.
     */
    sheet.addRow([]);

    /*
     * Main table header.
     *
     * Batch is now included as an explicit column because all
     * batches can exist in this same worksheet.
     */
    sheet.addRow([
      "Batch",
      "Day",
      "Time",
      "Room",
      "Program",
      "Course Code",
      "Course Title",
      "Section",
      "Credit",
      "Faculty",
      "Type",
    ]);

    applyHeaderStyle(sheet.getRow(5));

    sheet.views = [
      {
        state: "frozen",
        ySplit: 5,
      },
    ];

    let currentRow = 6;

    /*
     * No data case.
     */
    if (!targetBatches.length || !rows.length) {
      const emptyRow = sheet.addRow([
        "No batch routine rows found for the selected filters.",
      ]);

      sheet.mergeCells(
        `A${emptyRow.number}:K${emptyRow.number}`
      );

      emptyRow.getCell(1).alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      currentRow += 1;
    } else {
      /*
       * Append each batch sequentially into the SAME worksheet.
       */
      for (const batch of targetBatches) {
        const batchRows = rows.filter(
          (row) =>
            row.batchCodes.includes(batch)
        );

        /*
         * Skip batches without matching rows.
         */
        if (!batchRows.length) {
          continue;
        }

        /*
         * Batch section heading.
         */
        sheet.mergeCells(
          `A${currentRow}:K${currentRow}`
        );

        const batchHeading =
          sheet.getCell(`A${currentRow}`);

        batchHeading.value =
          `BATCH ${batch}`;

        batchHeading.font = {
          bold: true,
          size: 13,
        };

        batchHeading.alignment = {
          horizontal: "center",
          vertical: "middle",
        };

        batchHeading.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFDCE6F1",
          },
        };

        sheet.getRow(currentRow).height = 28;

        currentRow += 1;

        /*
         * Determine day order for this batch.
         */
        const sortedDays = uniqueStrings(
          batchRows.map(
            (row) => row.dayOfWeek
          )
        )
          .filter(
            (day) => day !== "-"
          )
          .sort(
            (a, b) =>
              (DAY_ORDER[a] ?? 99) -
              (DAY_ORDER[b] ?? 99)
          );

        /*
         * Rows without an assigned day should not disappear.
         * They are placed after the normal weekday sections.
         */
        const hasUnscheduledRows =
          batchRows.some(
            (row) =>
              !row.dayOfWeek ||
              row.dayOfWeek === "-"
          );

        const batchDayGroups =
          hasUnscheduledRows
            ? [...sortedDays, "-"]
            : sortedDays;

        for (const day of batchDayGroups) {
          /*
           * Day heading.
           */
          sheet.mergeCells(
            `A${currentRow}:K${currentRow}`
          );

          const dayHeading =
            sheet.getCell(
              `A${currentRow}`
            );

          dayHeading.value =
            day === "-"
              ? "UNSCHEDULED"
              : day;

          dayHeading.font = {
            bold: true,
            size: 11,
          };

          dayHeading.alignment = {
            horizontal: "left",
            vertical: "middle",
          };

          dayHeading.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: "FFEEF2FF",
            },
          };

          sheet.getRow(currentRow).height = 24;

          currentRow += 1;

          const dayRows =
            batchRows
              .filter((row) => {
                if (day === "-") {
                  return (
                    !row.dayOfWeek ||
                    row.dayOfWeek === "-"
                  );
                }

                return (
                  row.dayOfWeek === day
                );
              })
              .sort((a, b) => {
                const startCompare =
                  String(
                    a.startTime || ""
                  ).localeCompare(
                    String(
                      b.startTime || ""
                    )
                  );

                if (startCompare !== 0) {
                  return startCompare;
                }

                return String(
                  a.courseCode || ""
                ).localeCompare(
                  String(
                    b.courseCode || ""
                  )
                );
              });

          for (const row of dayRows) {
            const displayDay =
              row.dayOfWeek &&
              row.dayOfWeek !== "-"
                ? row.dayOfWeek
                : "-";

            const displayTime =
              row.startTime &&
              row.endTime &&
              row.startTime !== "-" &&
              row.endTime !== "-"
                ? `${row.startTime} - ${row.endTime}`
                : "-";

            const excelRow =
              sheet.addRow([
                batch,
                displayDay,
                displayTime,
                row.roomCode || "-",
                row.programCode || "-",
                row.courseCode || "-",
                row.courseTitle || "-",
                row.section || "-",
                row.credit,
                row.facultyText || "-",
                row.scheduleKind || "-",
              ]);

            applyDataStyle(
              excelRow
            );

            currentRow += 1;
          }

          /*
           * Space between day sections.
           */
          sheet.addRow([]);

          currentRow += 1;
        }

        /*
         * Additional separation between batches.
         */
        sheet.addRow([]);

        currentRow += 1;
      }
    }

    /*
     * Column widths.
     */
    sheet.columns = [
      {
        key: "batch",
        width: 14,
      },
      {
        key: "day",
        width: 14,
      },
      {
        key: "time",
        width: 18,
      },
      {
        key: "room",
        width: 14,
      },
      {
        key: "program",
        width: 20,
      },
      {
        key: "courseCode",
        width: 16,
      },
      {
        key: "courseTitle",
        width: 40,
      },
      {
        key: "section",
        width: 10,
      },
      {
        key: "credit",
        width: 10,
      },
      {
        key: "faculty",
        width: 35,
      },
      {
        key: "type",
        width: 12,
      },
    ];

    /*
     * Standard row formatting.
     *
     * Explicit section-heading heights set above remain readable,
     * while normal rows receive the common height.
     */
    sheet.eachRow(
      (
        row,
        rowNumber
      ) => {
        if (
          rowNumber !== 1 &&
          rowNumber !== 2 &&
          rowNumber !== 3
        ) {
          if (!row.height) {
            row.height = 24;
          }
        }
      }
    );

    const buffer =
      await workbook.xlsx.writeBuffer();

    return new Response(
      buffer,
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

          "Content-Disposition":
            `attachment; filename="${safeFileName(
              termName
            )}_batch_wise_combined_routine.xlsx"`,
        },
      }
    );
  } catch (error) {
    console.error(
      "Batch-wise routine export failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export batch-wise routine.",
      },
      {
        status: 500,
      }
    );
  }
}
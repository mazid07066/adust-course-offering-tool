import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { uniqueStrings } from "@/lib/report-visible-statuses";
import { getReportScheduleRows } from "@/lib/reporting/reporting-engine";

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const { term, rows } = await getReportScheduleRows({
      termName: searchParams.get("termName") || "",
      batchCode: searchParams.get("batchCode") || "",
      status: searchParams.get("status") || "",
    });

    const expandedRows = rows.flatMap((row) => {
      const batchCodes = row.batchCodes.length ? row.batchCodes : ["-"];

      return batchCodes.map((batchCode) => ({
        batchCode,
        programCode: row.programCode,
        courseCode: row.courseCode,
        courseTitle: row.courseTitle,
        section: row.section,
        facultyText: row.facultyText,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        roomCode: row.roomCode,
        role: row.role,
      }));
    });

    expandedRows.sort((a, b) => {
      if (a.batchCode !== b.batchCode) return a.batchCode.localeCompare(b.batchCode);
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek.localeCompare(b.dayOfWeek);
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
      return a.courseCode.localeCompare(b.courseCode);
    });

    const batchOptions = uniqueStrings(expandedRows.map((row) => row.batchCode));

    return NextResponse.json(
      {
        success: true,
        termName: term.name,
        batchOptions,
        summary: {
          totalRows: expandedRows.length,
          totalBatches: batchOptions.length,
        },
        rows: expandedRows,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Failed to load batch routine report.";

    return NextResponse.json(
      { error: message },
      { status: message.includes("required") ? 400 : message.includes("not found") ? 404 : 500 }
    );
  }
}
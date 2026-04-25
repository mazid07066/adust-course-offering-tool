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
      roomCode: searchParams.get("roomCode") || "",
      status: searchParams.get("status") || "",
    });

    const roomRows = rows
      .filter((row) => row.roomCode !== "-")
      .map((row) => ({
        roomCode: row.roomCode,
        roomType: row.roomType,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        programCode: row.programCode,
        courseCode: row.courseCode,
        courseTitle: row.courseTitle,
        section: row.section,
        facultyText: row.facultyText,
        batchCodes: row.batchCodes,
        role: row.role,
      }));

    const roomOptions = uniqueStrings(roomRows.map((row) => row.roomCode));

    return NextResponse.json(
      {
        success: true,
        termName: term.name,
        roomOptions,
        summary: {
          totalRows: roomRows.length,
          totalRooms: roomOptions.length,
        },
        rows: roomRows,
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
      error instanceof Error ? error.message : "Failed to load room schedule report.";

    return NextResponse.json(
      { error: message },
      { status: message.includes("required") ? 400 : message.includes("not found") ? 404 : 500 }
    );
  }
}
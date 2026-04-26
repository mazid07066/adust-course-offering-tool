import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getScheduleRowsForReporting } from "@/lib/reporting-data";

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const termName = String(searchParams.get("termName") || "").trim();
    const programCode = String(searchParams.get("programCode") || "").trim();
    const batchCode = String(searchParams.get("batchCode") || "").trim();
    const scheduleKind = String(searchParams.get("scheduleKind") || "ALL").trim();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const rows = await getScheduleRowsForReporting({
      termName,
      programCode: programCode || undefined,
      batchCode: batchCode || undefined,
      scheduleKind:
        scheduleKind === "CLASS" ||
        scheduleKind === "LAB" ||
        scheduleKind === "PROJECT"
          ? scheduleKind
          : "ALL",
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: rows.length,
        rowsWithRoom: rows.filter((row) => row.roomCode && row.roomCode !== "-")
          .length,
        rowsWithoutRoom: rows.filter(
          (row) => !row.roomCode || row.roomCode === "-"
        ).length,
        rowsWithFaculty: rows.filter(
          (row) => row.facultyText && row.facultyText !== "-"
        ).length,
        rowsWithoutFaculty: rows.filter(
          (row) => !row.facultyText || row.facultyText === "-"
        ).length,
      },
      rows,
    });
  } catch (error) {
    console.error("Confirmed schedule report failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load confirmed schedule report.",
      },
      { status: 500 }
    );
  }
}
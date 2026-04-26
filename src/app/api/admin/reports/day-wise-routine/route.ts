import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getScheduleRowsForReporting } from "@/lib/reporting-data";
import { uniqueStrings } from "@/lib/report-visible-statuses";

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

    const days = uniqueStrings(rows.map((row) => row.dayOfWeek)).filter(
      (day) => day !== "-"
    );

    return NextResponse.json({
      success: true,
      dayOptions: days,
      summary: {
        totalRows: rows.length,
        totalDays: days.length,
        classRows: rows.filter((row) => row.scheduleKind === "CLASS").length,
        labRows: rows.filter((row) => row.scheduleKind === "LAB").length,
        projectRows: rows.filter((row) => row.scheduleKind === "PROJECT").length,
      },
      groups: days.map((day) => ({
        dayOfWeek: day,
        rows: rows.filter((row) => row.dayOfWeek === day),
      })),
      rows,
    });
  } catch (error) {
    console.error("Day-wise routine report failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load day-wise routine report.",
      },
      { status: 500 }
    );
  }
}
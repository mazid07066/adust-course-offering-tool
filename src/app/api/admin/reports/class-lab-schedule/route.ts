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

    const allowedKind =
      scheduleKind === "CLASS" ||
      scheduleKind === "LAB" ||
      scheduleKind === "PROJECT"
        ? scheduleKind
        : "ALL";

    const rows = await getScheduleRowsForReporting({
      termName,
      programCode: programCode || undefined,
      batchCode: batchCode || undefined,
      scheduleKind: allowedKind,
    });

    const classRows = rows.filter((row) => row.scheduleKind === "CLASS");
    const labRows = rows.filter((row) => row.scheduleKind === "LAB");
    const projectRows = rows.filter((row) => row.scheduleKind === "PROJECT");

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: rows.length,
        classRows: classRows.length,
        labRows: labRows.length,
        projectRows: projectRows.length,
        totalPrograms: uniqueStrings(rows.map((row) => row.programCode)).length,
        totalBatches: uniqueStrings(rows.flatMap((row) => row.batchCodes)).length,
      },
      groups: {
        classRows,
        labRows,
        projectRows,
      },
      rows,
    });
  } catch (error) {
    console.error("Class/lab schedule report failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load class/lab schedule report.",
      },
      { status: 500 }
    );
  }
}
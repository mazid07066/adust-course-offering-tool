import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getOfferingSummaryRowsForReporting } from "@/lib/reporting-data";
import { uniqueStrings } from "@/lib/report-visible-statuses";

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const termName = String(searchParams.get("termName") || "").trim();
    const programCode = String(searchParams.get("programCode") || "").trim();
    const batchCode = String(searchParams.get("batchCode") || "").trim();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const rows = await getOfferingSummaryRowsForReporting({
      termName,
      programCode: programCode || undefined,
      batchCode: batchCode || undefined,
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: rows.length,
        totalCourses: uniqueStrings(rows.map((row) => row.courseCode)).length,
        totalPrograms: uniqueStrings(rows.map((row) => row.programCode)).length,
        totalBatches: uniqueStrings(rows.flatMap((row) => row.batchCodes)).length,
        totalCredits: rows.reduce((sum, row) => sum + row.credit, 0),
        assignedRows: rows.filter((row) => row.facultyText !== "-").length,
        unassignedRows: rows.filter((row) => row.facultyText === "-").length,
      },
      rows,
    });
  } catch (error) {
    console.error("Offering summary report failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load offering summary report.",
      },
      { status: 500 }
    );
  }
}
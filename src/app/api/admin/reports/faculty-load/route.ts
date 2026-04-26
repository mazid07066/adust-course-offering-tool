import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getFacultyLoadRowsForReporting } from "@/lib/reporting-data";

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const termName = String(searchParams.get("termName") || "").trim();
    const programCode = String(searchParams.get("programCode") || "").trim();
    const batchCode = String(searchParams.get("batchCode") || "").trim();
    const teacherCode = String(searchParams.get("teacherCode") || "").trim();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const rows = await getFacultyLoadRowsForReporting({
      termName,
      programCode: programCode || undefined,
      batchCode: batchCode || undefined,
      teacherCode: teacherCode || undefined,
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalFaculty: rows.length,
        totalCredits: rows.reduce((sum, row) => sum + row.totalCredits, 0),
        theoryCredits: rows.reduce((sum, row) => sum + row.theoryCredits, 0),
        labCredits: rows.reduce((sum, row) => sum + row.labCredits, 0),
        projectCredits: rows.reduce((sum, row) => sum + row.projectCredits, 0),
      },
      rows,
    });
  } catch (error) {
    console.error("Faculty load report failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load faculty load report.",
      },
      { status: 500 }
    );
  }
}
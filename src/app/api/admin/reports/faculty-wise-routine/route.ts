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
    const teacherCode = String(searchParams.get("teacherCode") || "").trim();
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
      teacherCode: teacherCode || undefined,
      scheduleKind:
        scheduleKind === "CLASS" ||
        scheduleKind === "LAB" ||
        scheduleKind === "PROJECT"
          ? scheduleKind
          : "ALL",
    });

    const facultyOptions = uniqueStrings(
      rows.flatMap((row) =>
        row.facultyCodes.map((code, index) => {
          const name = row.facultyNames[index] || "";
          return name ? `${code} - ${name}` : code;
        })
      )
    ).sort();

    return NextResponse.json({
      success: true,
      facultyOptions,
      summary: {
        totalRows: rows.length,
        totalFaculty: facultyOptions.length,
        classRows: rows.filter((row) => row.scheduleKind === "CLASS").length,
        labRows: rows.filter((row) => row.scheduleKind === "LAB").length,
        projectRows: rows.filter((row) => row.scheduleKind === "PROJECT").length,
      },
      groups: facultyOptions.map((faculty) => {
        const code = faculty.split(" - ")[0];

        return {
          faculty,
          teacherCode: code,
          rows: rows.filter((row) => row.facultyCodes.includes(code)),
        };
      }),
      rows,
    });
  } catch (error) {
    console.error("Faculty-wise routine report failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load faculty-wise routine report.",
      },
      { status: 500 }
    );
  }
}
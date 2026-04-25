import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getReportScheduleRows,
  summarizeScheduleRows,
} from "@/lib/reporting/reporting-engine";

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const { term, filters, rows } = await getReportScheduleRows({
      termName: searchParams.get("termName") || "",
      programCode: searchParams.get("programCode") || "",
      batchCode: searchParams.get("batchCode") || "",
      status: searchParams.get("status") || "",
    });

    const map = new Map<number, any>();

    for (const row of rows) {
      if (!map.has(row.offeredCourseId)) {
        map.set(row.offeredCourseId, {
          offeredCourseId: row.offeredCourseId,
          offeringId: row.offeringId,
          offeringStatus: row.offeringStatus,
          programCode: row.programCode,
          programName: row.programName,
          courseCode: row.courseCode,
          courseTitle: row.courseTitle,
          courseType: row.courseType,
          section: row.section,
          credit: row.credit,
          role: row.role,
          primaryReference: row.primaryReference,
          batchCodes: row.batchCodes,
          facultyText: row.facultyText,
          assignedFacultyCount: row.assignedFacultyCount,
          scheduleText: row.scheduleText,
          linkedSecondaryCourseCodes: row.linkedSecondaryCourseCodes,
          linkedSecondaryCourseText: row.linkedSecondaryCourseText,
          linkedSecondaryBatchCodes: row.linkedSecondaryBatchCodes,
        });
      }
    }

    const offeringRows = Array.from(map.values()).sort((a, b) => {
      if (a.programCode !== b.programCode) return a.programCode.localeCompare(b.programCode);
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.courseCode.localeCompare(b.courseCode);
    });

    return NextResponse.json(
      {
        success: true,
        termName: term.name,
        filters,
        summary: {
          ...summarizeScheduleRows(rows),
          totalOfferingRows: offeringRows.length,
        },
        rows: offeringRows,
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
      error instanceof Error ? error.message : "Failed to load confirmed offering report.";

    return NextResponse.json(
      { error: message },
      { status: message.includes("required") ? 400 : message.includes("not found") ? 404 : 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

type DuplicateRow = {
  id: number;
  offered_course_id: number;
  teacher_id: number;
};

export async function POST() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const rows = await prisma.offered_course_teachers.findMany({
      select: {
        id: true,
        offered_course_id: true,
        teacher_id: true,
      },
      orderBy: [{ id: "asc" }],
    });

    const seen = new Map<string, DuplicateRow>();
    const duplicateIdsToDelete: number[] = [];

    for (const row of rows) {
      const key = `${row.offered_course_id}::${row.teacher_id}`;

      if (!seen.has(key)) {
        seen.set(key, row);
        continue;
      }

      duplicateIdsToDelete.push(row.id);
    }

    let deletedCount = 0;

    if (duplicateIdsToDelete.length > 0) {
      const result = await prisma.offered_course_teachers.deleteMany({
        where: {
          id: {
            in: duplicateIdsToDelete,
          },
        },
      });

      deletedCount = result.count;
    }

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      success: true,
      message:
        deletedCount > 0
          ? `Removed ${deletedCount} duplicate offered_course_teachers row(s).`
          : "No duplicate offered_course_teachers rows were found.",
      deletedCount,
    });
  } catch (error) {
    console.error(error);
    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      { error: "Failed to deduplicate offered course teacher rows." },
      { status: 500 }
    );
  }
}
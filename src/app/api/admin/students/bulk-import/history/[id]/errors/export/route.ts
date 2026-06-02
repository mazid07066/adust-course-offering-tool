import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  buildStudentImportErrorCsv,
  listStudentImportErrorRows,
} from "@/lib/student-import-audit";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const importLogId = Number(id);

    if (!Number.isFinite(importLogId) || importLogId <= 0) {
      return NextResponse.json(
        { error: "Valid import log id is required." },
        { status: 400 }
      );
    }

    const rows = await listStudentImportErrorRows(importLogId);
    const csv = buildStudentImportErrorCsv(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="student_import_${importLogId}_errors.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to export student import error rows." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { listStudentImportErrorRows } from "@/lib/student-import-audit";

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

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student import error rows." },
      { status: 500 }
    );
  }
}
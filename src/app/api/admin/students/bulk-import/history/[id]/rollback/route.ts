import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { rollbackStudentImport } from "@/lib/student-import-audit";

export async function POST(
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

    const result = await rollbackStudentImport(importLogId);

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to roll back student import.",
      },
      { status: 500 }
    );
  }
}
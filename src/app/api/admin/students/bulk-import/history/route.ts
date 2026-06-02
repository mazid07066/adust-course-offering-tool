import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { listStudentImportLogs } from "@/lib/student-import-audit";

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 20);

    const logs = await listStudentImportLogs(
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20
    );

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student import history." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getStudentVerificationList } from "@/lib/student-verification";

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const programIdRaw = searchParams.get("programId");
    const batchIdRaw = searchParams.get("batchId");

    const programId = programIdRaw ? Number(programIdRaw) : null;
    const batchId = batchIdRaw ? Number(batchIdRaw) : null;

    const result = await getStudentVerificationList({
      programId: Number.isFinite(programId || 0) && programId ? programId : null,
      batchId: Number.isFinite(batchId || 0) && batchId ? batchId : null,
      status: String(searchParams.get("status") || "").trim(),
      keyword: String(searchParams.get("keyword") || "").trim(),
      limit: Number(searchParams.get("limit") || 100),
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student verification list." },
      { status: 500 }
    );
  }
}
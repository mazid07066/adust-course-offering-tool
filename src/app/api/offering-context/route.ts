import { NextRequest, NextResponse } from "next/server";
import { buildOfferingContext } from "@/lib/offering-context";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const { searchParams } = new URL(req.url);
    const programCode = String(searchParams.get("programCode") || "").trim();
    const batchCode = String(searchParams.get("batchCode") || "").trim();

    if (!programCode) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "programCode is required.",
        },
        { status: 400 }
      );
    }

    if (!batchCode) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "batchCode is required.",
        },
        { status: 400 }
      );
    }

    const result = await buildOfferingContext({
      programCode,
      batchCode,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load offering context.";

    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
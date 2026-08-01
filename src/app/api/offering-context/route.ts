import { NextRequest, NextResponse } from "next/server";
import { buildOfferingContext } from "@/lib/offering-context";
import {
  isAcademicTermContextError,
} from "@/lib/academic-term-context";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireCoordinatorOrAdminApi();

    if (guard instanceof Response) {
      return guard;
    }

    const { searchParams } = new URL(req.url);

    const programCode = String(
      searchParams.get("programCode") || ""
    ).trim();

    const batchCode = String(
      searchParams.get("batchCode") || ""
    ).trim();

    const requestedTermName = String(
      searchParams.get("termName") || ""
    )
      .trim()
      .toUpperCase();

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
      termName: requestedTermName || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isAcademicTermContextError(error)) {
      const status =
        error.code === "ACADEMIC_TERM_NOT_FOUND"
          ? 404
          : 409;

      return NextResponse.json(
        {
          ok: false,
          success: false,
          code: error.code,
          error: error.message,
        },
        { status }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load offering context.";

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
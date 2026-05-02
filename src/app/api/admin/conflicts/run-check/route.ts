import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { scanScheduleConflicts } from "@/lib/schedule-conflict-scanner";

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

export async function GET(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(request.url);

    const termName = normalizeText(searchParams.get("termName"));
    const offeringIdRaw = searchParams.get("offeringId");
    const offeringId = offeringIdRaw ? Number(offeringIdRaw) : undefined;

    if (!termName && !offeringId) {
      return NextResponse.json(
        {
          ok: false,
          error: "termName or offeringId is required.",
        },
        { status: 400 }
      );
    }

    const result = await scanScheduleConflicts({
      termName: termName || undefined,
      offeringId:
        typeof offeringId === "number" && Number.isFinite(offeringId)
          ? offeringId
          : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to run schedule conflict check.",
      },
      { status: 500 }
    );
  }
}
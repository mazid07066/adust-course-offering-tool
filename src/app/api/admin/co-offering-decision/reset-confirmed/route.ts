import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();
    const offeringId = Number(body.offeringId);

    if (!Number.isFinite(offeringId) || offeringId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Valid offeringId is required." },
        { status: 400 }
      );
    }

    const offering = await prisma.offerings.findUnique({
      where: { id: offeringId },
      include: {
        programs: true,
        academic_terms: true,
      },
    });

    if (!offering) {
      return NextResponse.json(
        { ok: false, error: "Offering not found." },
        { status: 404 }
      );
    }

    if (offering.status !== "CONFIRMED") {
      return NextResponse.json(
        {
          ok: false,
          error: `Only CONFIRMED offering can be reset. Current status: ${offering.status}`,
        },
        { status: 400 }
      );
    }

    await prisma.offerings.update({
      where: { id: offering.id },
      data: {
        status: "FACULTY_CHOICE_FINALIZED",
      },
    });

    clearReportingCacheWithLog("co-offering decision reset confirmed offering");

    return NextResponse.json({
      ok: true,
      message: `${offering.programs.short_name} ${offering.academic_terms.name} reset from CONFIRMED to FACULTY_CHOICE_FINALIZED.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reset confirmed offering.",
      },
      { status: 500 }
    );
  }
}

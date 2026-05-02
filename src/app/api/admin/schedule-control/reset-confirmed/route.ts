import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { offeringId } = await req.json();

    if (!offeringId) {
      return NextResponse.json(
        { ok: false, error: "offeringId required" },
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
        { ok: false, error: "Offering not found" },
        { status: 404 }
      );
    }

    if (offering.status !== "CONFIRMED") {
      return NextResponse.json({
        ok: false,
        error: "Only CONFIRMED offering can be reset",
      });
    }

    await prisma.offerings.update({
      where: { id: offeringId },
      data: {
        status: "FACULTY_CHOICE_FINALIZED",
      },
    });

    clearReportingCacheWithLog("offering reset from confirmed");

    return NextResponse.json({
      ok: true,
      message: `${offering.programs.short_name} reset to editable state.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Reset failed" },
      { status: 500 }
    );
  }
}
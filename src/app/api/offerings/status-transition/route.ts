import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { OFFERING_STATUS } from "@/lib/offering-status";

export async function POST(req: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await req.json();

    const offeringId = Number(body.offeringId);
    const targetStatus = String(body.targetStatus || "").trim();

    if (!offeringId) {
      return NextResponse.json(
        { ok: false, error: "offeringId is required." },
        { status: 400 }
      );
    }

    const validStatuses = Object.values(OFFERING_STATUS);

    if (!validStatuses.includes(targetStatus as any)) {
      return NextResponse.json(
        { ok: false, error: "Invalid target status." },
        { status: 400 }
      );
    }

    const offering = await prisma.offerings.findUnique({
      where: { id: offeringId },
    });

    if (!offering) {
      return NextResponse.json(
        { ok: false, error: "Offering not found." },
        { status: 404 }
      );
    }

    // Prevent going backwards from CONFIRMED
    if (offering.status === OFFERING_STATUS.CONFIRMED) {
      return NextResponse.json(
        { ok: false, error: "Confirmed offering cannot be modified." },
        { status: 400 }
      );
    }

    await prisma.offerings.update({
      where: { id: offeringId },
      data: {
        status: targetStatus,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Offering moved to ${targetStatus}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update status.",
      },
      { status: 500 }
    );
  }
}
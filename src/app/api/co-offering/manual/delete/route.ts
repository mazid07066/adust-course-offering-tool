import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const body = await req.json();
    const manualCoofferId = Number(body.manualCoofferId);

    if (!Number.isFinite(manualCoofferId) || manualCoofferId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Valid manualCoofferId is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.offered_course_manual_cooffers.findUnique({
      where: {
        id: manualCoofferId,
      },
      include: {
        offered_courses: {
          include: {
            offerings: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Manual co-offered code entry not found." },
        { status: 404 }
      );
    }

    if (!["DRAFT", "BUFFER_READY"].includes(String(existing.offered_courses.offerings.status || ""))) {
      return NextResponse.json(
        { ok: false, error: "Manual co-offered codes can only be edited before final publish." },
        { status: 400 }
      );
    }

    await prisma.offered_course_manual_cooffers.delete({
      where: {
        id: manualCoofferId,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Manual co-offered code removed successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove manual co-offered code.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
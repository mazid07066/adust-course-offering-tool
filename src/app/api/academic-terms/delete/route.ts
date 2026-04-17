import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { termId } = await request.json();

    if (!termId) {
      return NextResponse.json(
        { error: "termId is required" },
        { status: 400 }
      );
    }

    const offeringUse = await prisma.offerings.count({
      where: { academic_term_id: termId },
    });

    const registrationUse = await prisma.batch_current_registrations.count({
      where: { academic_term_id: termId },
    });

    const completedUse = await prisma.batch_completed_courses.count({
      where: { academic_term_id: termId },
    });

    const totalUse = offeringUse + registrationUse + completedUse;

    if (totalUse > 0) {
      return NextResponse.json(
        {
          error:
            `Cannot delete term because it is already used in ` +
            `${offeringUse} offering(s), ` +
            `${registrationUse} current registration record(s), and ` +
            `${completedUse} completed-course record(s).`,
        },
        { status: 400 }
      );
    }

    await prisma.academic_terms.delete({
      where: { id: termId },
    });

    return NextResponse.json({
      success: true,
      message: "Academic term deleted successfully.",
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Delete failed",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

const ALLOWED_STATUSES = [
  "DRAFT",
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
];

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const primaryId = Number(body.primaryId);
    const secondaryId = Number(body.secondaryId);

    if (!primaryId || !secondaryId || primaryId === secondaryId) {
      return NextResponse.json(
        { ok: false, error: "Valid primaryId and secondaryId are required." },
        { status: 400 }
      );
    }

    const primary = await prisma.offered_courses.findUnique({
      where: { id: primaryId },
      include: {
        offerings: {
          include: {
            academic_terms: true,
            programs: true,
          },
        },
        master_courses: true,
      },
    });

    const secondary = await prisma.offered_courses.findUnique({
      where: { id: secondaryId },
      include: {
        offerings: {
          include: {
            academic_terms: true,
            programs: true,
          },
        },
        master_courses: true,
      },
    });

    if (!primary || !secondary) {
      return NextResponse.json(
        { ok: false, error: "Selected course section was not found." },
        { status: 404 }
      );
    }

    if (
      !ALLOWED_STATUSES.includes(primary.offerings.status) ||
      !ALLOWED_STATUSES.includes(secondary.offerings.status)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Co-offering link is allowed only before CONFIRMED status.",
        },
        { status: 400 }
      );
    }

    if (
      primary.offerings.academic_term_id !== secondary.offerings.academic_term_id
    ) {
      return NextResponse.json(
        { ok: false, error: "Both courses must be in the same term." },
        { status: 400 }
      );
    }

    if (primary.primary_offered_course_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Selected primary is already a secondary co-offered course. Select its primary instead.",
        },
        { status: 400 }
      );
    }

    if (secondary.primary_offered_course_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Selected secondary is already linked under a primary.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.offered_courses.update({
        where: { id: secondary.id },
        data: {
          primary_offered_course_id: primary.id,
          is_cooffered: true,
        },
      });

      await tx.offered_courses.update({
        where: { id: primary.id },
        data: {
          is_cooffered: true,
        },
      });
    });

    clearReportingCacheWithLog("co-offering decision link created");

    return NextResponse.json({
      ok: true,
      message: `${secondary.master_courses.course_code} linked under ${primary.master_courses.course_code}.`,
    });
  } catch (error) {
    clearReportingCacheWithLog("co-offering decision link failed");

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create co-offering decision link.",
      },
      { status: 500 }
    );
  }
}
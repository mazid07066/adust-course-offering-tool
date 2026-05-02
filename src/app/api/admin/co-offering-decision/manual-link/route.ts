import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

const LINK_ALLOWED_STATUSES = [
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

    const primaryOfferedCourseId = Number(body.primaryOfferedCourseId);
    const secondaryOfferedCourseId = Number(body.secondaryOfferedCourseId);

    if (
      !Number.isFinite(primaryOfferedCourseId) ||
      primaryOfferedCourseId <= 0 ||
      !Number.isFinite(secondaryOfferedCourseId) ||
      secondaryOfferedCourseId <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Valid primaryOfferedCourseId and secondaryOfferedCourseId are required.",
        },
        { status: 400 }
      );
    }

    if (primaryOfferedCourseId === secondaryOfferedCourseId) {
      return NextResponse.json(
        { ok: false, error: "A course cannot be linked with itself." },
        { status: 400 }
      );
    }

    const primary = await prisma.offered_courses.findUnique({
      where: { id: primaryOfferedCourseId },
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
      where: { id: secondaryOfferedCourseId },
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

    if (primary.primary_offered_course_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Selected primary course is already a secondary co-offered course.",
        },
        { status: 400 }
      );
    }

    if (secondary.primary_offered_course_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Selected secondary course is already linked under another primary.",
        },
        { status: 400 }
      );
    }

    if (
      primary.offerings.academic_term_id !== secondary.offerings.academic_term_id
    ) {
      return NextResponse.json(
        { ok: false, error: "Both courses must be in the same academic term." },
        { status: 400 }
      );
    }

    if (primary.offerings.program_id === secondary.offerings.program_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Co-offering should link courses from different programs.",
        },
        { status: 400 }
      );
    }

    if (
      primary.offerings.status === "CONFIRMED" ||
      secondary.offerings.status === "CONFIRMED"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "One of the selected offerings is CONFIRMED. Reset it before linking.",
        },
        { status: 400 }
      );
    }

    if (
      !LINK_ALLOWED_STATUSES.includes(primary.offerings.status) ||
      !LINK_ALLOWED_STATUSES.includes(secondary.offerings.status)
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

    clearReportingCacheWithLog("manual course-level co-offering link created");

    return NextResponse.json({
      ok: true,
      message: `${secondary.offerings.programs.short_name} ${secondary.master_courses.course_code} Sec-${secondary.section} linked under ${primary.offerings.programs.short_name} ${primary.master_courses.course_code} Sec-${primary.section}.`,
    });
  } catch (error) {
    clearReportingCacheWithLog("manual course-level co-offering link failed");

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create manual co-offering link.",
      },
      { status: 500 }
    );
  }
}
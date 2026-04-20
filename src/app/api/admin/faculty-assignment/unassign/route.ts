import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ALLOWED_OFFERING_STATUSES = [
  "DRAFT",
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const termName = String(body.termName || "").trim().toUpperCase();
    const offeredCourseId = Number(body.offeredCourseId);

    if (!termName || !offeredCourseId) {
      return NextResponse.json(
        { error: "termName and offeredCourseId are required." },
        { status: 400 }
      );
    }

    const term = await prisma.academic_terms.findFirst({
      where: { name: termName },
      select: { id: true, name: true },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const course = await prisma.offered_courses.findFirst({
      where: {
        id: offeredCourseId,
        primary_offered_course_id: null,
        offerings: {
          academic_term_id: term.id,
          status: {
            in: ALLOWED_OFFERING_STATUSES,
          },
        },
      },
      include: {
        master_courses: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Offered section not found for the selected term." },
        { status: 404 }
      );
    }

    const deleted = await prisma.offered_course_teachers.deleteMany({
      where: {
        offered_course_id: offeredCourseId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "No faculty assignment found to remove for this section." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Removed faculty assignment from ${course.master_courses.course_code} section ${course.section}.`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to unassign faculty." },
      { status: 500 }
    );
  }
}
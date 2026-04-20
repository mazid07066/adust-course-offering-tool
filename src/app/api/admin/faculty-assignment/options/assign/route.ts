import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ALLOWED_OFFERING_STATUSES = [
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
    const teacherId = Number(body.teacherId);

    if (!termName || !offeredCourseId || !teacherId) {
      return NextResponse.json(
        { error: "termName, offeredCourseId, and teacherId are required." },
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

    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        teacher_code: true,
        full_name: true,
        designation: true,
        is_active: true,
      },
    });

    if (!teacher || !teacher.is_active) {
      return NextResponse.json(
        { error: "Selected faculty is not active or does not exist." },
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

    await prisma.$transaction(async (tx) => {
      await tx.offered_course_teachers.deleteMany({
        where: {
          offered_course_id: offeredCourseId,
        },
      });

      await tx.offered_course_teachers.create({
        data: {
          offered_course_id: offeredCourseId,
          teacher_id: teacherId,
          assigned_credit: Number(course.master_courses.credit || 0),
          load_type: "CHOICE_ASSIGNMENT",
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Assigned ${teacher.teacher_code} - ${teacher.full_name} to ${course.master_courses.course_code} section ${course.section}.`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to assign faculty." },
      { status: 500 }
    );
  }
}
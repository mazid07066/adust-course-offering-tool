import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getFacultyLoadLevel,
  getFacultyLoadMessage,
} from "@/lib/faculty-assignment-policy";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

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
    const teacherId = Number(body.teacherId);

    if (!termName || !offeredCourseId || !teacherId) {
      clearReportingCacheWithLog("offering/reporting data changed");
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
      clearReportingCacheWithLog("offering/reporting data changed");
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
      clearReportingCacheWithLog("offering/reporting data changed");
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
      clearReportingCacheWithLog("offering/reporting data changed");
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

    const teacherLoadRows = await prisma.offered_course_teachers.findMany({
      where: {
        teacher_id: teacherId,
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
          },
        },
      },
      select: {
        assigned_credit: true,
      },
    });

    const totalAssignedCredits = teacherLoadRows.reduce(
      (sum, row) => sum + Number(row.assigned_credit || 0),
      0
    );

    const loadLevel = getFacultyLoadLevel(totalAssignedCredits);
    const loadMessage = getFacultyLoadMessage(totalAssignedCredits);

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      success: true,
      message: `Assigned ${teacher.teacher_code} - ${teacher.full_name} to ${course.master_courses.course_code} section ${course.section}.`,
      loadLevel,
      totalAssignedCredits,
      loadMessage,
    });
  } catch (error) {
    console.error(error);
    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      { error: "Failed to assign faculty." },
      { status: 500 }
    );
  }
}
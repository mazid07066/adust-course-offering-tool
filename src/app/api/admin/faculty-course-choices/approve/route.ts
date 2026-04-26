import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { createFacultyNotification } from "@/lib/faculty-notifications";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

const ALLOWED_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();
    const teacherId = Number(body.teacherId);
    const termName = String(body.termName || "").trim().toUpperCase();

    if (!teacherId || !termName) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { error: "teacherId and termName are required." },
        { status: 400 }
      );
    }

    const [teacher, term] = await Promise.all([
      prisma.teachers.findUnique({
        where: { id: teacherId },
        select: {
          id: true,
          teacher_code: true,
          full_name: true,
          designation: true,
          is_active: true,
        },
      }),
      prisma.academic_terms.findFirst({
        where: { name: termName },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!teacher || !teacher.is_active) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { error: "Teacher not found or inactive." },
        { status: 404 }
      );
    }

    if (!term) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const finalSelections = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
        status: "FINAL",
      },
      include: {
        offered_courses: {
          include: {
            offerings: true,
            master_courses: true,
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
          },
        },
      },
      orderBy: [{ priority_order: "asc" }, { id: "asc" }],
    });

    if (finalSelections.length === 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { error: "No FINAL faculty choices found to approve." },
        { status: 400 }
      );
    }

    let assignedCount = 0;
    let skippedAlreadyAssignedToSameTeacher = 0;
    let skippedAssignedToAnotherTeacher = 0;
    let skippedInvalidStatus = 0;

    for (const selection of finalSelections) {
      const course = selection.offered_courses;

      if (!ALLOWED_OFFERING_STATUSES.includes(course.offerings.status)) {
        skippedInvalidStatus += 1;
        continue;
      }

      const existingAssignments = course.offered_course_teachers || [];

      const assignedToSameTeacher = existingAssignments.some(
        (row) => row.teacher_id === teacher.id
      );

      if (assignedToSameTeacher) {
        skippedAlreadyAssignedToSameTeacher += 1;
        continue;
      }

      const assignedToAnotherTeacher = existingAssignments.some(
        (row) => row.teacher_id !== teacher.id
      );

      if (assignedToAnotherTeacher) {
        skippedAssignedToAnotherTeacher += 1;
        continue;
      }

      await prisma.offered_course_teachers.create({
        data: {
          offered_course_id: course.id,
          teacher_id: teacher.id,
          assigned_credit: Number(course.master_courses.credit || 0),
          load_type: "APPROVED_CHOICE",
        },
      });

      assignedCount += 1;
    }

    const linkedUsers = await prisma.users.findMany({
      where: {
        teacher_id: teacher.id,
        is_active: true,
        role: "FACULTY",
      },
      select: { id: true },
    });

    for (const user of linkedUsers) {
      await createFacultyNotification({
        recipientUserId: user.id,
        recipientTeacherId: teacher.id,
        createdByUserId: guard.id,
        eventType: "FACULTY_CHOICE_APPROVED",
        title: "Faculty choices approved",
        message: `Your final course choices for ${term.name} were approved and applied to the assignment board.`,
      });
    }

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      success: true,
      message: `Approval completed. Assigned ${assignedCount}, skipped already assigned to same teacher ${skippedAlreadyAssignedToSameTeacher}, skipped assigned to another teacher ${skippedAssignedToAnotherTeacher}, skipped invalid status ${skippedInvalidStatus}.`,
      assignedCount,
      skippedAlreadyAssignedToSameTeacher,
      skippedAssignedToAnotherTeacher,
      skippedInvalidStatus,
    });
  } catch (error) {
    console.error(error);
    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      { error: "Failed to approve faculty final choices." },
      { status: 500 }
    );
  }
}
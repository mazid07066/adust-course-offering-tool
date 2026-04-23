import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { createFacultyNotification } from "@/lib/faculty-notifications";

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();
    const teacherId = Number(body.teacherId);
    const termName = String(body.termName || "").trim().toUpperCase();

    if (!teacherId || !termName) {
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
      return NextResponse.json(
        { error: "Teacher not found or inactive." },
        { status: 404 }
      );
    }

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const deleteResult = await prisma.offered_course_teachers.deleteMany({
      where: {
        teacher_id: teacher.id,
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
          },
        },
      },
    });

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
        eventType: "FACULTY_ASSIGNMENT_REMOVED",
        title: "Approved assignment removed",
        message: `Your approved assignment for ${term.name} was removed by coordinator/admin. Please review the updated assignment status.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Removed ${deleteResult.count} approved assignment row(s) for ${teacher.teacher_code} - ${teacher.full_name}.`,
      removedCount: deleteResult.count,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to remove approved assignment." },
      { status: 500 }
    );
  }
}
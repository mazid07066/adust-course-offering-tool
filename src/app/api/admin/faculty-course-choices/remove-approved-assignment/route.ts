import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { createFacultyNotification } from "@/lib/faculty-notifications";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

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

    if (!teacher) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { error: "Faculty member not found." },
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

    /*
      IMPORTANT:
      This removes ONLY assignments created from faculty choices.
      It does NOT remove imported/template/admin-preassigned rows.
    */
    const deleted = await prisma.offered_course_teachers.deleteMany({
      where: {
        teacher_id: teacher.id,
        load_type: "APPROVED_CHOICE",
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
      select: {
        id: true,
      },
    });

    for (const user of linkedUsers) {
      await createFacultyNotification({
        recipientUserId: user.id,
        recipientTeacherId: teacher.id,
        createdByUserId: guard.id,
        eventType: "FACULTY_APPROVED_CHOICE_ASSIGNMENT_REMOVED",
        title: "Approved choice assignment removed",
        message: `Coordinator/admin removed ${deleted.count} approved faculty-choice assignment row(s) for ${term.name}. Imported/preassigned courses were not changed.`,
      });
    }

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      success: true,
      message: `Removed ${deleted.count} approved faculty-choice assignment row(s) for ${teacher.teacher_code} - ${teacher.full_name}. Imported/preassigned assignments were kept unchanged.`,
      deletedCount: deleted.count,
    });
  } catch (error) {
    console.error("Remove approved faculty choice assignment error:", error);

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove approved faculty choice assignments.",
      },
      { status: 500 }
    );
  }
}
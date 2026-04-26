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
        select: { id: true, teacher_code: true, full_name: true },
      }),
      prisma.academic_terms.findFirst({
        where: { name: termName },
        select: { id: true, name: true },
      }),
    ]);

    if (!teacher || !term) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { error: "Teacher or term not found." },
        { status: 404 }
      );
    }

    await prisma.faculty_course_selections.deleteMany({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
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
        eventType: "FACULTY_CHOICE_CLEARED",
        title: "Faculty choices cleared",
        message: `Your submitted choices for ${term.name} were cleared by coordinator/admin. Please submit your choices again.`,
      });
    }

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      success: true,
      message: "Faculty choices cleared successfully.",
    });
  } catch (error) {
    console.error(error);
    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      { error: "Failed to clear faculty choices." },
      { status: 500 }
    );
  }
}
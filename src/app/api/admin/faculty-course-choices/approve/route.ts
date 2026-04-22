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
        select: { id: true, teacher_code: true, full_name: true },
      }),
      prisma.academic_terms.findFirst({
        where: { name: termName },
        select: { id: true, name: true },
      }),
    ]);

    if (!teacher || !term) {
      return NextResponse.json(
        { error: "Teacher or term not found." },
        { status: 404 }
      );
    }

    const finalRows = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
        status: "FINAL",
      },
      select: { id: true },
    });

    if (finalRows.length === 0) {
      return NextResponse.json(
        { error: "No final faculty choices found to approve." },
        { status: 400 }
      );
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
        message: `Your final course choices for ${term.name} were approved by coordinator/admin.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Faculty choices approved successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to approve faculty choices." },
      { status: 500 }
    );
  }
}
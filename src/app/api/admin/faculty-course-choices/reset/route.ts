import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

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

    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        teacher_code: true,
        full_name: true,
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "Faculty member not found." },
        { status: 404 }
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

    const existingCount = await prisma.faculty_course_selections.count({
      where: {
        teacher_id: teacherId,
        academic_term_id: term.id,
      },
    });

    if (existingCount === 0) {
      return NextResponse.json(
        {
          error: "No faculty choices found for this faculty and term.",
        },
        { status: 400 }
      );
    }

    const deleted = await prisma.faculty_course_selections.deleteMany({
      where: {
        teacher_id: teacherId,
        academic_term_id: term.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Reset ${deleted.count} choice record(s) for ${teacher.teacher_code} - ${teacher.full_name}.`,
      deletedCount: deleted.count,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to reset faculty choices." },
      { status: 500 }
    );
  }
}
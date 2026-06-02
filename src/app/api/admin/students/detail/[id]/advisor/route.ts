import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const studentDbId = Number(id);

    if (!Number.isFinite(studentDbId)) {
      return NextResponse.json({ error: "Invalid student id." }, { status: 400 });
    }

    const body = await request.json();
    const teacherId = Number(body.teacher_id || body.advisor_teacher_id);
    const remarks = String(body.reason || body.remarks || "").trim() || null;

    if (!Number.isFinite(teacherId) || teacherId <= 0) {
      return NextResponse.json(
        { error: "Valid teacher/advisor is required." },
        { status: 400 }
      );
    }

    const [student, teacher] = await Promise.all([
      prisma.students.findUnique({
        where: { id: studentDbId },
        select: { id: true },
      }),
      prisma.teachers.findUnique({
        where: { id: teacherId },
        select: { id: true, is_active: true },
      }),
    ]);

    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    if (!teacher || teacher.is_active === false) {
      return NextResponse.json(
        { error: "Selected advisor is not active or does not exist." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.student_advisor_assignments.updateMany({
        where: {
          student_id_ref: studentDbId,
          is_active: true,
        },
        data: {
          is_active: false,
          ended_at: new Date(),
        },
      });

      await tx.student_advisor_assignments.create({
        data: {
          student_id_ref: studentDbId,
          teacher_id: teacherId,
          is_active: true,
          remarks,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Advisor assignment updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update advisor assignment." },
      { status: 500 }
    );
  }
}
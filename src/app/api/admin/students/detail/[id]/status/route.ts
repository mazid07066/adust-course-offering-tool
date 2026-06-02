import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ALLOWED_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "DROPPED",
  "SUSPENDED",
  "COMPLETED",
  "TRANSFERRED",
];

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
    const newStatus = String(body.new_status || "").trim().toUpperCase();
    const note = String(body.reason || "").trim() || null;

    if (!ALLOWED_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const student = await prisma.students.findUnique({
      where: { id: studentDbId },
      select: {
        id: true,
        current_status: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.students.update({
        where: { id: studentDbId },
        data: {
          current_status: newStatus,
        },
      });

      await tx.student_status_history.create({
        data: {
          student_id_ref: studentDbId,
          old_status: student.current_status,
          new_status: newStatus,
          note,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Student status updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update student status." },
      { status: 500 }
    );
  }
}
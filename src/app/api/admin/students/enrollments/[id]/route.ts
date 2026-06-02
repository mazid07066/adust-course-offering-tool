import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanUpper(value: unknown) {
  return clean(value).toUpperCase();
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const enrollmentId = Number(id);

    if (!Number.isFinite(enrollmentId) || enrollmentId <= 0) {
      return NextResponse.json(
        { error: "Valid enrollment id is required." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const batchId =
      body.batchId === null || body.batchId === ""
        ? null
        : Number(body.batchId);

    const enrollmentStatus = cleanUpper(body.enrollmentStatus || "ACTIVE");
    const admissionSemester = cleanUpper(body.admissionSemester || "");

    if (batchId !== null && (!Number.isFinite(batchId) || batchId <= 0)) {
      return NextResponse.json(
        { error: "Invalid batch id." },
        { status: 400 }
      );
    }

    const existing = await prisma.student_program_enrollments.findUnique({
      where: { id: enrollmentId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Enrollment not found." },
        { status: 404 }
      );
    }

    if (batchId) {
      const duplicate = await prisma.student_program_enrollments.findFirst({
        where: {
          id: { not: enrollmentId },
          student_id_ref: existing.student_id_ref,
          program_id: existing.program_id,
          batch_id: batchId,
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            error:
              "Another enrollment already exists for this student, program, and batch.",
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.student_program_enrollments.update({
      where: { id: enrollmentId },
      data: {
        batch_id: batchId,
        admission_semester: admissionSemester || null,
        enrollment_status: enrollmentStatus || "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      enrollment: updated,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update enrollment.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const enrollmentId = Number(id);

    if (!Number.isFinite(enrollmentId) || enrollmentId <= 0) {
      return NextResponse.json(
        { error: "Valid enrollment id is required." },
        { status: 400 }
      );
    }

    await prisma.student_program_enrollments.delete({
      where: { id: enrollmentId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete enrollment.",
      },
      { status: 500 }
    );
  }
}
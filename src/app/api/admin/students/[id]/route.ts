import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function cleanNullableString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function cleanRequiredString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function parseOptionalInt(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseOptionalDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const studentDbId = Number(id);

    if (!Number.isFinite(studentDbId)) {
      return NextResponse.json(
        { error: "Invalid student id." },
        { status: 400 }
      );
    }

    const student = await prisma.students.findUnique({
      where: { id: studentDbId },
      include: {
        enrollments: {
          include: {
            program: true,
            batches: true,
          },
          orderBy: [{ id: "desc" }],
        },
        contacts: true,
        status_history: {
          orderBy: [{ changed_at: "desc" }],
        },
        advisor_assignments: {
          include: {
            teachers: true,
          },
          orderBy: [{ assigned_at: "desc" }],
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const studentDbId = Number(id);

    if (!Number.isFinite(studentDbId)) {
      return NextResponse.json(
        { error: "Invalid student id." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const existing = await prisma.students.findUnique({
      where: { id: studentDbId },
      select: { id: true, current_status: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    const nextStatus = cleanRequiredString(body.current_status);

    const updated = await prisma.$transaction(async (tx) => {
      const student = await tx.students.update({
        where: { id: studentDbId },
        data: {
          student_id: cleanRequiredString(body.student_id)
            ? String(cleanRequiredString(body.student_id)).toUpperCase()
            : undefined,
          full_name: cleanRequiredString(body.full_name),
          gender: cleanNullableString(body.gender),
          date_of_birth: parseOptionalDate(body.date_of_birth),
          email: cleanNullableString(body.email),
          phone: cleanNullableString(body.phone),
          guardian_name: cleanNullableString(body.guardian_name),
          guardian_phone: cleanNullableString(body.guardian_phone),
          present_address: cleanNullableString(body.present_address),
          permanent_address: cleanNullableString(body.permanent_address),
          admission_year: parseOptionalInt(body.admission_year),
          admission_term_name: cleanRequiredString(body.admission_term_name)
            ? String(cleanRequiredString(body.admission_term_name)).toUpperCase()
            : undefined,
          current_status: nextStatus,
          remarks: cleanNullableString(body.remarks),
        },
      });

      if (nextStatus && nextStatus !== existing.current_status) {
        await tx.student_status_history.create({
          data: {
            student_id_ref: studentDbId,
            old_status: existing.current_status,
            new_status: nextStatus,
            note: "Status changed from admin student profile.",
          },
        });
      }

      return student;
    });

    return NextResponse.json({
      success: true,
      student: updated,
    });
  } catch (error: any) {
    console.error(error);

    if (String(error?.code) === "P2002") {
      return NextResponse.json(
        { error: "Another student already has this Student ID." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update student." },
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
    const studentDbId = Number(id);

    if (!Number.isFinite(studentDbId)) {
      return NextResponse.json(
        { error: "Invalid student id." },
        { status: 400 }
      );
    }

    await prisma.students.delete({
      where: { id: studentDbId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete student." },
      { status: 500 }
    );
  }
}
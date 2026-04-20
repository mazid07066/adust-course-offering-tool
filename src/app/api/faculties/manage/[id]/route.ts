import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const facultyId = Number(id);

    if (!facultyId) {
      return NextResponse.json({ error: "Invalid faculty id." }, { status: 400 });
    }

    const body = await request.json();

    const data: {
      full_name?: string;
      designation?: string | null;
      email?: string | null;
      phone?: string | null;
      is_active?: boolean;
      department_id?: number;
    } = {};

    if (body.full_name !== undefined) {
      const full_name = String(body.full_name || "").trim();
      if (!full_name) {
        return NextResponse.json(
          { error: "Full name cannot be empty." },
          { status: 400 }
        );
      }
      data.full_name = full_name;
    }

    if (body.designation !== undefined) {
      data.designation = normalizeNullableString(body.designation);
    }

    if (body.email !== undefined) {
      data.email = normalizeNullableString(body.email);
    }

    if (body.phone !== undefined) {
      data.phone = normalizeNullableString(body.phone);
    }

    if (body.is_active !== undefined) {
      data.is_active = Boolean(body.is_active);
    }

    if (body.department_id !== undefined) {
      const department_id = Number(body.department_id);

      if (!department_id) {
        return NextResponse.json(
          { error: "Invalid department id." },
          { status: 400 }
        );
      }

      const department = await prisma.departments.findUnique({
        where: { id: department_id },
      });

      if (!department) {
        return NextResponse.json(
          { error: "Selected department does not exist." },
          { status: 404 }
        );
      }

      data.department_id = department_id;
    }

    const updated = await prisma.teachers.update({
      where: { id: facultyId },
      data,
      include: {
        departments: true,
      },
    });

    return NextResponse.json({
      success: true,
      faculty: updated,
      message: "Faculty updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update faculty." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const facultyId = Number(id);

    if (!facultyId) {
      return NextResponse.json({ error: "Invalid faculty id." }, { status: 400 });
    }

    const linkedUser = await prisma.users.findFirst({
      where: { teacher_id: facultyId },
      select: { id: true, username: true },
    });

    if (linkedUser) {
      return NextResponse.json(
        {
          error: `Cannot delete faculty because it is linked with user "${linkedUser.username}". Remove the user link first.`,
        },
        { status: 400 }
      );
    }

    const assignmentCount = await prisma.offered_course_teachers.count({
      where: { teacher_id: facultyId },
    });

    if (assignmentCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete faculty because it is already used in offered course assignments.",
        },
        { status: 400 }
      );
    }

    const selectionCount = await prisma.faculty_course_selections.count({
      where: { teacher_id: facultyId },
    });

    if (selectionCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete faculty because it already has faculty course selections.",
        },
        { status: 400 }
      );
    }

    await prisma.teachers.delete({
      where: { id: facultyId },
    });

    return NextResponse.json({
      success: true,
      message: "Faculty deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete faculty." },
      { status: 500 }
    );
  }
}
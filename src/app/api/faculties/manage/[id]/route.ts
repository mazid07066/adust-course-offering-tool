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
    const facultyId = Number(id);

    const body = await request.json();

    const {
      full_name,
      designation,
      email,
      phone,
      seniority_level,
      is_active,
    } = body;

    const updated = await prisma.teachers.update({
      where: { id: facultyId },
      data: {
        full_name: full_name?.trim(),
        designation: designation?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        seniority_level:
          seniority_level === "" || seniority_level === null || seniority_level === undefined
            ? undefined
            : Number(seniority_level),
        is_active: typeof is_active === "boolean" ? is_active : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      faculty: updated,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update faculty" },
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

    await prisma.teachers.delete({
      where: { id: facultyId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeNullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
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
      return NextResponse.json(
        { error: "Invalid faculty id." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const full_name =
      body.full_name === undefined ? undefined : String(body.full_name || "").trim();
    const designation =
      body.designation === undefined ? undefined : normalizeNullableString(body.designation);
    const email =
      body.email === undefined ? undefined : normalizeNullableString(body.email);
    const phone =
      body.phone === undefined ? undefined : normalizeNullableString(body.phone);
    const is_active =
      typeof body.is_active === "boolean" ? body.is_active : undefined;
    const seniority_level =
      body.seniority_level === undefined
        ? undefined
        : body.seniority_level === "" || body.seniority_level === null
        ? null
        : Number(body.seniority_level);

    if (
      seniority_level !== undefined &&
      seniority_level !== null &&
      (!Number.isInteger(seniority_level) || seniority_level < 1 || seniority_level > 20)
    ) {
      return NextResponse.json(
        { error: "Seniority level must be an integer between 1 and 20." },
        { status: 400 }
      );
    }

    const updated = await prisma.teachers.update({
      where: { id: facultyId },
      data: {
        full_name: full_name || undefined,
        designation,
        email,
        phone,
        seniority_level,
        is_active,
      },
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
      return NextResponse.json(
        { error: "Invalid faculty id." },
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
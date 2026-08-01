import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function parseId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid committee id.");
  }

  return id;
}

function parseDisplayOrder(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const committeeId = parseId(id);
    const body = await req.json();

    const committeeCode = String(body.committee_code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    const committeeName = String(body.committee_name || "").trim();
    const description = String(body.description || "").trim() || null;
    const displayOrder = parseDisplayOrder(body.display_order);
    const isActive =
      typeof body.is_active === "boolean" ? body.is_active : true;

    if (!committeeCode) {
      return NextResponse.json(
        { error: "Committee code is required." },
        { status: 400 }
      );
    }

    if (!committeeName) {
      return NextResponse.json(
        { error: "Committee name is required." },
        { status: 400 }
      );
    }

    const duplicate = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM baete_committees
      WHERE committee_code = ${committeeCode}
        AND id <> ${committeeId}
      LIMIT 1;
    `;

    if (duplicate[0]) {
      return NextResponse.json(
        { error: "Another committee already uses this code." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE baete_committees
      SET
        committee_code = ${committeeCode},
        committee_name = ${committeeName},
        description = ${description},
        display_order = ${displayOrder},
        is_active = ${isActive},
        updated_at = NOW()
      WHERE id = ${committeeId};
    `;

    return NextResponse.json({
      success: true,
      message: "Committee updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update committee.",
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
    const committeeId = parseId(id);

    await prisma.$executeRaw`
      UPDATE baete_committees
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = ${committeeId};
    `;

    return NextResponse.json({
      success: true,
      message: "Committee archived successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to archive committee.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function parseId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid criterion id.");
  }

  return id;
}

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDisplayOrder(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const criterionId = parseId(id);
    const body = await req.json();

    const criterionCode = String(body.criterion_code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim() || null;
    const weight = parseNumber(body.weight, 0);
    const minimumScore = parseNumber(body.minimum_acceptable_score, 3.6);
    const displayOrder = parseDisplayOrder(body.display_order);
    const isActive =
      typeof body.is_active === "boolean" ? body.is_active : true;

    if (!criterionCode) {
      return NextResponse.json(
        { error: "Criterion code is required." },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Criterion title is required." },
        { status: 400 }
      );
    }

    if (weight < 0 || weight > 100) {
      return NextResponse.json(
        { error: "Weight must be between 0 and 100." },
        { status: 400 }
      );
    }

    if (minimumScore < 0 || minimumScore > 5) {
      return NextResponse.json(
        { error: "Minimum acceptable score must be between 0 and 5." },
        { status: 400 }
      );
    }

    const duplicate = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM baete_criteria
      WHERE criterion_code = ${criterionCode}
        AND id <> ${criterionId}
      LIMIT 1;
    `;

    if (duplicate[0]) {
      return NextResponse.json(
        { error: "Another criterion already uses this code." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE baete_criteria
      SET
        criterion_code = ${criterionCode},
        title = ${title},
        description = ${description},
        weight = ${weight},
        minimum_acceptable_score = ${minimumScore},
        display_order = ${displayOrder},
        is_active = ${isActive},
        updated_at = NOW()
      WHERE id = ${criterionId};
    `;

    return NextResponse.json({
      success: true,
      message: "Criterion updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update criterion.",
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
    const criterionId = parseId(id);

    await prisma.$executeRaw`
      UPDATE baete_criteria
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = ${criterionId};
    `;

    return NextResponse.json({
      success: true,
      message: "Criterion archived successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to archive criterion.",
      },
      { status: 500 }
    );
  }
}
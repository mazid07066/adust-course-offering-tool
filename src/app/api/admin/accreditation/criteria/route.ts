import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDisplayOrder(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const criteria = await prisma.$queryRaw<
      Array<{
        id: number;
        criterion_code: string;
        title: string;
        description: string | null;
        weight: number;
        minimum_acceptable_score: number;
        display_order: number;
        is_active: boolean;
      }>
    >`
      SELECT
        id,
        criterion_code,
        title,
        description,
        weight,
        minimum_acceptable_score,
        display_order,
        is_active
      FROM baete_criteria
      ORDER BY is_active DESC, display_order ASC, criterion_code ASC;
    `;

    return NextResponse.json({
      success: true,
      criteria,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load BAETE criteria." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
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
      LIMIT 1;
    `;

    if (duplicate[0]) {
      return NextResponse.json(
        { error: "Criterion code already exists." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO baete_criteria (
        criterion_code,
        title,
        description,
        weight,
        minimum_acceptable_score,
        display_order,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        ${criterionCode},
        ${title},
        ${description},
        ${weight},
        ${minimumScore},
        ${displayOrder},
        TRUE,
        NOW(),
        NOW()
      );
    `;

    return NextResponse.json({
      success: true,
      message: "Criterion created successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create criterion.",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function parseDisplayOrder(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const committees = await prisma.$queryRaw<
      Array<{
        id: number;
        committee_code: string;
        committee_name: string;
        description: string | null;
        is_active: boolean;
        display_order: number;
      }>
    >`
      SELECT
        id,
        committee_code,
        committee_name,
        description,
        is_active,
        display_order
      FROM baete_committees
      ORDER BY is_active DESC, display_order ASC, committee_name ASC;
    `;

    return NextResponse.json({
      success: true,
      committees,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load BAETE committees." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const committeeCode = String(body.committee_code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    const committeeName = String(body.committee_name || "").trim();
    const description = String(body.description || "").trim() || null;
    const displayOrder = parseDisplayOrder(body.display_order);

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

    const existing = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM baete_committees
      WHERE committee_code = ${committeeCode}
      LIMIT 1;
    `;

    if (existing[0]) {
      return NextResponse.json(
        { error: "Committee code already exists." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO baete_committees (
        committee_code,
        committee_name,
        description,
        display_order,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        ${committeeCode},
        ${committeeName},
        ${description},
        ${displayOrder},
        TRUE,
        NOW(),
        NOW()
      );
    `;

    return NextResponse.json({
      success: true,
      message: "Committee created successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create committee.",
      },
      { status: 500 }
    );
  }
}

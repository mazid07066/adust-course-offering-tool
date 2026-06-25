import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

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
      WHERE is_active = TRUE
      ORDER BY display_order ASC, committee_name ASC;
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

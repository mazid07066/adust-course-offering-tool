import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const users = await prisma.$queryRaw<
      Array<{
        id: number;
        display_name: string;
        email: string | null;
        role: string | null;
        is_active_text: string | null;
      }>
    >`
      SELECT
        u.id,
        COALESCE(
          to_jsonb(u)->>'name',
          to_jsonb(u)->>'full_name',
          to_jsonb(u)->>'display_name',
          to_jsonb(u)->>'email',
          'User ' || u.id::text
        ) AS display_name,
        to_jsonb(u)->>'email' AS email,
        to_jsonb(u)->>'role' AS role,
        to_jsonb(u)->>'is_active' AS is_active_text
      FROM users u
      WHERE COALESCE(to_jsonb(u)->>'is_active', 'true') <> 'false'
      ORDER BY
        COALESCE(to_jsonb(u)->>'role', '') ASC,
        COALESCE(
          to_jsonb(u)->>'name',
          to_jsonb(u)->>'full_name',
          to_jsonb(u)->>'display_name',
          to_jsonb(u)->>'email',
          'User ' || u.id::text
        ) ASC;
    `;

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("BAETE assignee load error:", error);

    return NextResponse.json(
      { error: "Failed to load assignable users." },
      { status: 500 }
    );
  }
}

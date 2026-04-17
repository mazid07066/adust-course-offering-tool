import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  await requireCoordinatorOrAdminApi();

  try {
    const terms = await prisma.academic_terms.findMany({
      orderBy: [{ year: "desc" }, { name: "desc" }],
    });

    return NextResponse.json({
      success: true,
      terms: terms.map((t) => ({
        id: t.id,
        name: t.name,
        year: t.year,
        termType: t.term_type,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load academic terms.",
      },
      { status: 500 }
    );
  }
}
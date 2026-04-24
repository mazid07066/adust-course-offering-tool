import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ACTIVE_TERM_NAME = "SUMMER 2026";

export async function GET() {
  try {
    let term = await prisma.academic_terms.findFirst({
      where: {
        name: ACTIVE_TERM_NAME,
      },
    });

    if (!term) {
      term = await prisma.academic_terms.create({
        data: {
          name: ACTIVE_TERM_NAME,
          year: 2026,
          term_type: "SUMMER",
          is_active: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      activeTermName: ACTIVE_TERM_NAME,
      terms: [
        {
          id: term.id,
          name: term.name,
          year: term.year,
          termType: term.term_type,
        },
      ],
    });
  } catch (error) {
    console.error("Academic terms options error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load academic terms.",
      },
      { status: 500 }
    );
  }
}
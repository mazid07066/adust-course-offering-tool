import { NextResponse } from "next/server";
import {
  isAcademicTermContextError,
  resolveAcademicTermContext,
} from "@/lib/academic-term-context";

export async function GET() {
  try {
    const term = await resolveAcademicTermContext();

    return NextResponse.json({
      success: true,
      activeTermName: term.name,
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

    const status = isAcademicTermContextError(error) ? 409 : 500;

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load academic terms.",
      },
      { status }
    );
  }
}

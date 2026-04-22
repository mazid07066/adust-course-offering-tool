import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();
    const termName = String(body.termName || "").trim().toUpperCase();
    const mode = String(body.mode || "PROGRAM").trim().toUpperCase();
    const programCode = String(body.programCode || "").trim().toUpperCase();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const term = await prisma.academic_terms.findFirst({
      where: { name: termName },
      select: { id: true, name: true },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    let updatedCount = 0;

    if (mode === "ALL") {
      const result = await prisma.offerings.updateMany({
        where: {
          academic_term_id: term.id,
          status: "FACULTY_CHOICE_BUFFER",
        },
        data: {
          status: "FACULTY_CHOICE_FINALIZED",
        },
      });

      updatedCount = result.count;
    } else {
      if (!programCode) {
        return NextResponse.json(
          { error: "programCode is required for PROGRAM mode." },
          { status: 400 }
        );
      }

      const program = await prisma.programs.findFirst({
        where: { short_name: programCode },
        select: { id: true, short_name: true },
      });

      if (!program) {
        return NextResponse.json(
          { error: "Program not found." },
          { status: 404 }
        );
      }

      const result = await prisma.offerings.updateMany({
        where: {
          academic_term_id: term.id,
          program_id: program.id,
          status: "FACULTY_CHOICE_BUFFER",
        },
        data: {
          status: "FACULTY_CHOICE_FINALIZED",
        },
      });

      updatedCount = result.count;
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      message:
        updatedCount > 0
          ? `Closed ${updatedCount} offering(s) into FACULTY_CHOICE_FINALIZED.`
          : "No FACULTY_CHOICE_BUFFER offering found to close.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to close faculty choice offerings." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const programCode = String(
      searchParams.get("programCode") ||
        searchParams.get("code") ||
        searchParams.get("shortName") ||
        ""
    )
      .trim()
      .toUpperCase();

    if (!programCode) {
      return NextResponse.json(
        { error: "programCode is required." },
        { status: 400 }
      );
    }

    const program = await prisma.programs.findFirst({
      where: {
        short_name: programCode,
      },
      select: {
        id: true,
        short_name: true,
        name: true,
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: `Program ${programCode} was not found.` },
        { status: 404 }
      );
    }

    const batches = await prisma.batches.findMany({
      where: {
        program_id: program.id,
        is_active: true,
      },
      orderBy: [{ batch_code: "asc" }],
      select: {
        id: true,
        batch_code: true,
        admission_term: true,
        is_active: true,
      },
    });

    return NextResponse.json({
      success: true,
      program,
      batches: batches.map((batch) => ({
        id: batch.id,
        batchCode: batch.batch_code,
        batch_code: batch.batch_code,
        admissionTerm: batch.admission_term,
        admission_term: batch.admission_term,
        isActive: batch.is_active,
        is_active: batch.is_active,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load batches by program code.",
      },
      { status: 500 }
    );
  }
}
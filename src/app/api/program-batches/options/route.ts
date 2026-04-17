import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(request.url);
    const programCode = String(searchParams.get("programCode") || "")
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
      include: {
        batches: {
          orderBy: [{ batch_code: "asc" }],
        },
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Program not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      batches: program.batches.map((b) => ({
        id: b.id,
        batchCode: b.batch_code,
        admissionTerm: b.admission_term,
      })),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load batch options.",
      },
      { status: 500 }
    );
  }
}
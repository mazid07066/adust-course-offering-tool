import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(request.url);

    const programCode = String(searchParams.get("programCode") || "").trim().toUpperCase();
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

    const where: any = {
      status: "CONFIRMED",
    };

    if (programCode) {
      const program = await prisma.programs.findFirst({
        where: { short_name: programCode },
      });

      if (!program) {
        return NextResponse.json(
          { error: "Program not found." },
          { status: 404 }
        );
      }

      where.program_id = program.id;
    }

    if (termName) {
      const term = await prisma.academic_terms.findFirst({
        where: { name: termName },
      });

      if (!term) {
        return NextResponse.json({
          success: true,
          offerings: [],
        });
      }

      where.academic_term_id = term.id;
    }

    const offerings = await prisma.offerings.findMany({
      where,
      include: {
        academic_terms: true,
        programs: true,
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_batches: {
              include: {
                batches: true,
              },
            },
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
            offered_course_slots: {
              include: {
                rooms: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      offerings,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load confirmed offerings.",
      },
      { status: 500 }
    );
  }
}
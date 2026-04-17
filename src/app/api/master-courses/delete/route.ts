import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const programCode = body.programCode;

    if (!programCode) {
      return NextResponse.json(
        { error: "Program code is required" },
        { status: 400 }
      );
    }

    const program = await prisma.programs.findFirst({
      where: { short_name: programCode },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Program not found" },
        { status: 404 }
      );
    }

    await prisma.master_courses.deleteMany({
      where: {
        program_id: program.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "All courses deleted successfully",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}
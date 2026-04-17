import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(request.url);

    const programCode = searchParams.get("programCode");
    const batchCode = searchParams.get("batchCode");

    if (!programCode || !batchCode) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    /* ✅ find program */
    const program = await prisma.programs.findFirst({
      where: { short_name: programCode },
      include: {
        batches: true,
        master_courses: true,
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    /* ✅ find batch */
    const batch = program.batches.find(
      (b) => b.batch_code === batchCode
    );

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    /* ✅ remaining courses */
    const remainingCourses = program.master_courses;

    /* ✅ faculties */
    const faculties = await prisma.teachers.findMany({
      where: { is_active: true },
    });

    /* ✅ rooms */
    const rooms = await prisma.rooms.findMany({
      where: { is_active: true },
    });

    return NextResponse.json({
      success: true,
      program,
      batch,
      remainingCourses,
      faculties,
      rooms,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await request.json();

    const programCode = String(body.programCode || "").trim().toUpperCase();
    const batchCode = String(body.batchCode || "").trim();

    if (!programCode || !batchCode) {
      return NextResponse.json(
        { error: "programCode and batchCode are required." },
        { status: 400 }
      );
    }

    const program = await prisma.programs.findFirst({
      where: {
        short_name: programCode,
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Program not found." },
        { status: 404 }
      );
    }

    const batch = await prisma.batches.findFirst({
      where: {
        program_id: program.id,
        batch_code: batchCode,
      },
    });

    if (!batch) {
      return NextResponse.json(
        { error: "Batch not found under this program." },
        { status: 404 }
      );
    }

    const completedDelete = await prisma.batch_completed_courses.deleteMany({
      where: {
        batch_id: batch.id,
      },
    });

    const registrationDelete = await prisma.batch_current_registrations.deleteMany({
      where: {
        batch_id: batch.id,
      },
    });

    const logDelete = await prisma.student_report_logs.deleteMany({
      where: {
        student_name: `${program.short_name} Batch ${batch.batch_code}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Imported batch status deleted successfully.",
      deleted: {
        completedCourses: completedDelete.count,
        currentRegistrations: registrationDelete.count,
        reportLogs: logDelete.count,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to clean batch status.",
      },
      { status: 500 }
    );
  }
}
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
    const batchCode = String(searchParams.get("batchCode") || "").trim();

    if (!programCode || !batchCode) {
      return NextResponse.json(
        { error: "programCode and batchCode are required." },
        { status: 400 }
      );
    }

    const program = await prisma.programs.findFirst({
      where: { short_name: programCode },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found." }, { status: 404 });
    }

    const batch = await prisma.batches.findFirst({
      where: {
        program_id: program.id,
        batch_code: batchCode,
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    const completedCount = await prisma.batch_completed_courses.count({
      where: { batch_id: batch.id },
    });

    const ongoingCount = await prisma.batch_current_registrations.count({
      where: { batch_id: batch.id },
    });

    return NextResponse.json({
      success: true,
      summary: {
        programCode,
        batchCode,
        completedCount,
        ongoingCount,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load cleanup summary.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
      where: { short_name: programCode },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found." }, { status: 404 });
    }

    const batch = await prisma.batches.findFirst({
      where: {
        program_id: program.id,
        batch_code: batchCode,
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    const completedDeleted = await prisma.batch_completed_courses.deleteMany({
      where: { batch_id: batch.id },
    });

    const ongoingDeleted = await prisma.batch_current_registrations.deleteMany({
      where: { batch_id: batch.id },
    });

    return NextResponse.json({
      success: true,
      message: "Imported batch status cleaned successfully.",
      deleted: {
        completed: completedDeleted.count,
        ongoing: ongoingDeleted.count,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to clean batch status.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const batchId = Number(id);

    if (!Number.isFinite(batchId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid batch id." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const admissionTerm =
      body.admissionTerm === undefined
        ? undefined
        : String(body.admissionTerm || "").trim().toUpperCase();

    const isActive =
      body.isActive === undefined ? undefined : Boolean(body.isActive);

    const updated = await prisma.batches.update({
      where: {
        id: batchId,
      },
      data: {
        admission_term: admissionTerm === undefined ? undefined : admissionTerm || null,
        is_active: isActive,
      },
      include: {
        programs: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Batch updated successfully.",
      batch: {
        id: updated.id,
        programId: updated.program_id,
        programCode: updated.programs.short_name,
        programName: updated.programs.name,
        batchCode: updated.batch_code,
        admissionTerm: updated.admission_term || "",
        active: Boolean(updated.is_active),
      },
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Failed to update batch.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const batchId = Number(id);

    if (!Number.isFinite(batchId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid batch id." },
        { status: 400 }
      );
    }

    const linkedOfferingRows = await prisma.offered_course_batches.findFirst({
      where: {
        batch_id: batchId,
      },
      select: {
        id: true,
      },
    });

    if (linkedOfferingRows) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This batch is already used in offered courses. Remove offering links first before deleting.",
        },
        { status: 400 }
      );
    }

    await prisma.batch_completed_courses.deleteMany({
      where: {
        batch_id: batchId,
      },
    });

    await prisma.batch_current_registrations.deleteMany({
      where: {
        batch_id: batchId,
      },
    });

    await prisma.batches.delete({
      where: {
        id: batchId,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Batch deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Failed to delete batch.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
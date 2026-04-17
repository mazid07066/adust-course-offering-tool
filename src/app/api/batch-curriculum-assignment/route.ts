import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeCourseCode(text: string) {
  return String(text || "").replace(/\s+/g, "").trim().toUpperCase();
}

function normalizeTitle(text: string) {
  return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(request.url);

    const sourceProgramCode = String(searchParams.get("sourceProgramCode") || "")
      .trim()
      .toUpperCase();
    const batchCode = String(searchParams.get("batchCode") || "").trim();

    if (!sourceProgramCode || !batchCode) {
      return NextResponse.json(
        { error: "sourceProgramCode and batchCode are required." },
        { status: 400 }
      );
    }

    const sourceProgram = await prisma.programs.findFirst({
      where: { short_name: sourceProgramCode },
    });

    if (!sourceProgram) {
      return NextResponse.json(
        { error: "Source program not found." },
        { status: 404 }
      );
    }

    const sourceBatch = await prisma.batches.findFirst({
      where: {
        program_id: sourceProgram.id,
        batch_code: batchCode,
      },
    });

    if (!sourceBatch) {
      return NextResponse.json(
        { error: "Source batch not found." },
        { status: 404 }
      );
    }

    const completedCount = await prisma.batch_completed_courses.count({
      where: { batch_id: sourceBatch.id },
    });

    const currentCount = await prisma.batch_current_registrations.count({
      where: { batch_id: sourceBatch.id },
    });

    const offeringUsageCount = await prisma.offered_course_batches.count({
      where: { batch_id: sourceBatch.id },
    });

    const targetPrograms = await prisma.programs.findMany({
      include: {
        batches: {
          where: {
            batch_code: batchCode,
          },
        },
      },
      orderBy: [{ short_name: "asc" }],
    });

    return NextResponse.json({
      success: true,
      source: {
        batchId: sourceBatch.id,
        batchCode: sourceBatch.batch_code,
        admissionTerm: sourceBatch.admission_term,
        programCode: sourceProgram.short_name,
        programName: sourceProgram.name,
      },
      summary: {
        completedCount,
        currentCount,
        offeringUsageCount,
      },
      candidateTargets: targetPrograms.map((p) => ({
        programId: p.id,
        programCode: p.short_name,
        programName: p.name,
        alreadyHasSameBatchCode: p.batches.length > 0,
        existingBatchId: p.batches.length > 0 ? p.batches[0].id : null,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load batch curriculum assignment summary.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await request.json();

    const sourceProgramCode = String(body.sourceProgramCode || "")
      .trim()
      .toUpperCase();
    const targetProgramCode = String(body.targetProgramCode || "")
      .trim()
      .toUpperCase();
    const batchCode = String(body.batchCode || "").trim();

    if (!sourceProgramCode || !targetProgramCode || !batchCode) {
      return NextResponse.json(
        {
          error: "sourceProgramCode, targetProgramCode, and batchCode are required.",
        },
        { status: 400 }
      );
    }

    if (sourceProgramCode === targetProgramCode) {
      return NextResponse.json(
        { error: "Source and target program cannot be the same." },
        { status: 400 }
      );
    }

    const sourceProgram = await prisma.programs.findFirst({
      where: { short_name: sourceProgramCode },
    });

    const targetProgram = await prisma.programs.findFirst({
      where: { short_name: targetProgramCode },
    });

    if (!sourceProgram) {
      return NextResponse.json(
        { error: "Source program not found." },
        { status: 404 }
      );
    }

    if (!targetProgram) {
      return NextResponse.json(
        { error: "Target program not found." },
        { status: 404 }
      );
    }

    const sourceBatch = await prisma.batches.findFirst({
      where: {
        program_id: sourceProgram.id,
        batch_code: batchCode,
      },
    });

    if (!sourceBatch) {
      return NextResponse.json(
        { error: "Source batch not found." },
        { status: 404 }
      );
    }

    const offeringUsageCount = await prisma.offered_course_batches.count({
      where: { batch_id: sourceBatch.id },
    });

    if (offeringUsageCount > 0) {
      return NextResponse.json(
        {
          error:
            "This batch is already used in offered courses. Program/curriculum reassignment is blocked to protect offering integrity.",
        },
        { status: 400 }
      );
    }

    const targetBatchExisting = await prisma.batches.findFirst({
      where: {
        program_id: targetProgram.id,
        batch_code: batchCode,
      },
    });

    const sourceCompleted = await prisma.batch_completed_courses.findMany({
      where: { batch_id: sourceBatch.id },
    });

    const sourceCurrent = await prisma.batch_current_registrations.findMany({
      where: { batch_id: sourceBatch.id },
    });

    let finalBatchId = sourceBatch.id;
    let mergedIntoExisting = false;

    await prisma.$transaction(async (tx) => {
      if (!targetBatchExisting) {
        await tx.batches.update({
          where: { id: sourceBatch.id },
          data: {
            program_id: targetProgram.id,
          },
        });

        finalBatchId = sourceBatch.id;
      } else {
        mergedIntoExisting = true;
        finalBatchId = targetBatchExisting.id;

        const targetCompleted = await tx.batch_completed_courses.findMany({
          where: { batch_id: targetBatchExisting.id },
        });

        const targetCurrent = await tx.batch_current_registrations.findMany({
          where: { batch_id: targetBatchExisting.id },
        });

        for (const row of sourceCompleted) {
          const exists = targetCompleted.some(
            (t) =>
              normalizeCourseCode(t.course_code) === normalizeCourseCode(row.course_code) ||
              normalizeTitle(t.normalized_title || t.course_title) ===
                normalizeTitle(row.normalized_title || row.course_title)
          );

          if (!exists) {
            await tx.batch_completed_courses.create({
              data: {
                batch_id: targetBatchExisting.id,
                academic_term_id: row.academic_term_id,
                course_code: row.course_code,
                course_title: row.course_title,
                normalized_title: row.normalized_title,
                credit: row.credit,
                grade: row.grade,
                source_student_id: row.source_student_id,
                source_file_name: row.source_file_name,
              },
            });
          }
        }

        for (const row of sourceCurrent) {
          const exists = targetCurrent.some(
            (t) =>
              t.academic_term_id === row.academic_term_id &&
              (
                normalizeCourseCode(t.course_code) === normalizeCourseCode(row.course_code) ||
                normalizeTitle(t.normalized_title || t.course_title) ===
                  normalizeTitle(row.normalized_title || row.course_title)
              )
          );

          if (!exists) {
            await tx.batch_current_registrations.create({
              data: {
                batch_id: targetBatchExisting.id,
                academic_term_id: row.academic_term_id,
                course_code: row.course_code,
                course_title: row.course_title,
                normalized_title: row.normalized_title,
                credit: row.credit,
                source_student_id: row.source_student_id,
                source_file_name: row.source_file_name,
              },
            });
          }
        }

        await tx.batch_completed_courses.deleteMany({
          where: { batch_id: sourceBatch.id },
        });

        await tx.batch_current_registrations.deleteMany({
          where: { batch_id: sourceBatch.id },
        });

        await tx.batches.delete({
          where: { id: sourceBatch.id },
        });
      }

      await tx.student_report_logs.updateMany({
        where: {
          student_name: `${sourceProgram.short_name} Batch ${batchCode}`,
        },
        data: {
          student_name: `${targetProgram.short_name} Batch ${batchCode}`,
        },
      });
    });

    const finalCompletedCount = await prisma.batch_completed_courses.count({
      where: { batch_id: finalBatchId },
    });

    const finalCurrentCount = await prisma.batch_current_registrations.count({
      where: { batch_id: finalBatchId },
    });

    return NextResponse.json({
      success: true,
      message: mergedIntoExisting
        ? "Batch program/curriculum assigned successfully by merging into an existing target batch."
        : "Batch program/curriculum assigned successfully.",
      result: {
        batchCode,
        sourceProgramCode,
        targetProgramCode,
        finalBatchId,
        mergedIntoExisting,
        completedCount: finalCompletedCount,
        currentCount: finalCurrentCount,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to assign batch program/curriculum.",
      },
      { status: 500 }
    );
  }
}
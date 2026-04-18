import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

type SaveCompletedCourse = {
  code: string;
  title: string;
  semester: string;
  credits: number;
  grade: string;
};

type SaveOngoingCourse = {
  code: string;
  title: string;
  credits: number;
  section: string | null;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await request.json();

    const programCode = String(body.programCode || "").trim().toUpperCase();
    const batchCode = String(body.batchCode || "").trim();
    const studentId = String(body.studentId || "").trim();

    const latestCompletedTerm = body.latestCompletedTerm
      ? String(body.latestCompletedTerm).trim().toUpperCase()
      : null;

    const currentRegistrationTerm = body.currentRegistrationTerm
      ? String(body.currentRegistrationTerm).trim().toUpperCase()
      : null;

    const completedCourses = Array.isArray(body.completedCourses)
      ? (body.completedCourses as SaveCompletedCourse[])
      : [];

    const ongoingCourses = Array.isArray(body.ongoingCourses)
      ? (body.ongoingCourses as SaveOngoingCourse[])
      : [];

    if (!programCode) {
      return NextResponse.json({ error: "Program code is required." }, { status: 400 });
    }

    if (!batchCode) {
      return NextResponse.json({ error: "Batch code is required." }, { status: 400 });
    }

    const program = await prisma.programs.findFirst({
      where: {
        short_name: programCode,
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Program record not found. Import curriculum first." },
        { status: 400 }
      );
    }

    const batch = await prisma.batches.upsert({
      where: {
        uq_program_batch: {
          program_id: program.id,
          batch_code: batchCode,
        },
      },
      update: {},
      create: {
        program_id: program.id,
        batch_code: batchCode,
        is_active: true,
      },
    });

    let completedTermId: number | null = null;
    if (latestCompletedTerm) {
      const [termType, yearText] = latestCompletedTerm.split(" ");
      const year = Number(yearText);

      const term = await prisma.academic_terms.upsert({
        where: { name: latestCompletedTerm },
        update: {},
        create: {
          name: latestCompletedTerm,
          term_type: termType,
          year,
          is_active: true,
        },
      });

      completedTermId = term.id;
    }

    let registrationTermId: number | null = null;
    if (currentRegistrationTerm) {
      const [termType, yearText] = currentRegistrationTerm.split(" ");
      const year = Number(yearText);

      const term = await prisma.academic_terms.upsert({
        where: { name: currentRegistrationTerm },
        update: {},
        create: {
          name: currentRegistrationTerm,
          term_type: termType,
          year,
          is_active: true,
        },
      });

      registrationTermId = term.id;
    }

    await prisma.batch_completed_courses.deleteMany({
      where: {
        batch_id: batch.id,
      },
    });

    await prisma.batch_current_registrations.deleteMany({
      where: {
        batch_id: batch.id,
      },
    });

    if (completedCourses.length > 0) {
      await prisma.batch_completed_courses.createMany({
        data: completedCourses.map((course) => ({
          batch_id: batch.id,
          academic_term_id: completedTermId,
          course_code: course.code,
          course_title: course.title,
          normalized_title: course.title.toLowerCase().trim(),
          credit: Number(course.credits),
          grade: course.grade || null,
          source_student_id: studentId || null,
          source_file_name: null,
        })),
      });
    }

    if (ongoingCourses.length > 0 && registrationTermId) {
      await prisma.batch_current_registrations.createMany({
        data: ongoingCourses.map((course) => ({
          batch_id: batch.id,
          academic_term_id: registrationTermId,
          course_code: course.code,
          course_title: course.title,
          normalized_title: course.title.toLowerCase().trim(),
          credit: Number(course.credits),
          source_student_id: studentId || null,
          source_file_name: null,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Batch status saved successfully.",
      batchId: batch.id,
      savedCompleted: completedCourses.length,
      savedOngoing: ongoingCourses.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save batch status.",
      },
      { status: 500 }
    );
  }
}
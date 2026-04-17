import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeTitle(title: string) {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeCourseCode(raw: string) {
  return raw.replace(/\s+/g, "").trim().toUpperCase();
}

export async function GET(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(request.url);

    const programCode = String(searchParams.get("programCode") || "").trim().toUpperCase();
    const batchCode = String(searchParams.get("batchCode") || "").trim();

    if (!programCode || !batchCode) {
      return NextResponse.json(
        { error: "programCode and batchCode are required" },
        { status: 400 }
      );
    }

    const program = await prisma.programs.findFirst({
      where: {
        short_name: programCode,
      },
      include: {
        master_courses: {
          where: { is_active: true },
          orderBy: [{ level_term: "asc" }, { course_code: "asc" }],
        },
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Program not found" },
        { status: 404 }
      );
    }

    let batch = await prisma.batches.findFirst({
      where: {
        program_id: program.id,
        batch_code: batchCode,
      },
    });

    if (!batch) {
      batch = await prisma.batches.create({
        data: {
          program_id: program.id,
          batch_code: batchCode,
          admission_term: null,
          is_active: true,
        },
      });
    }

    const completed = await prisma.batch_completed_courses.findMany({
      where: { batch_id: batch.id },
      orderBy: { id: "asc" },
    });

    const current = await prisma.batch_current_registrations.findMany({
      where: { batch_id: batch.id },
      orderBy: { id: "asc" },
    });

    const completedByCode = new Set(completed.map((c) => normalizeCourseCode(c.course_code)));
    const completedByTitle = new Set(
      completed.map((c) => normalizeTitle(c.normalized_title || c.course_title))
    );

    const currentByCode = new Set(current.map((c) => normalizeCourseCode(c.course_code)));
    const currentByTitle = new Set(
      current.map((c) => normalizeTitle(c.normalized_title || c.course_title))
    );

    const allCourses = program.master_courses.map((course) => {
      const codeKey = normalizeCourseCode(course.course_code);
      const titleKey = normalizeTitle(course.normalized_title || course.course_title);

      const isCompleted =
        completedByCode.has(codeKey) || completedByTitle.has(titleKey);

      const isOngoing =
        currentByCode.has(codeKey) || currentByTitle.has(titleKey);

      let status: "COMPLETED" | "ONGOING" | "REMAINING" = "REMAINING";

      if (isCompleted) status = "COMPLETED";
      else if (isOngoing) status = "ONGOING";

      return {
        id: course.id,
        course_code: course.course_code,
        course_title: course.course_title,
        credit: course.credit,
        course_type: course.course_type,
        level_term: course.level_term,
        group_name: course.group_name,
        status,
      };
    });

    return NextResponse.json({
      success: true,
      program: {
        id: program.id,
        name: program.name,
        short_name: program.short_name,
      },
      batch: {
        id: batch.id,
        batch_code: batch.batch_code,
        admission_term: batch.admission_term,
      },
      summary: {
        total: allCourses.length,
        completed: allCourses.filter((c) => c.status === "COMPLETED").length,
        ongoing: allCourses.filter((c) => c.status === "ONGOING").length,
        remaining: allCourses.filter((c) => c.status === "REMAINING").length,
      },
      allCourses,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load batch status",
      },
      { status: 500 }
    );
  }
}
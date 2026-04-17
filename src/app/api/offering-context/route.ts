import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getLatestTerm, getNextSemester } from "@/lib/semester-utils";

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
    const relatedProgramCodesRaw = String(searchParams.get("relatedProgramCodes") || "")
      .trim()
      .toUpperCase();

    if (!programCode || !batchCode) {
      return NextResponse.json(
        { error: "programCode and batchCode are required" },
        { status: 400 }
      );
    }

    const relatedProgramCodes = relatedProgramCodesRaw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => x !== programCode);

    const homeProgram = await prisma.programs.findFirst({
      where: { short_name: programCode },
      include: {
        batches: {
          orderBy: { batch_code: "asc" },
        },
        master_courses: {
          where: { is_active: true },
          orderBy: [{ level_term: "asc" }, { course_code: "asc" }],
        },
      },
    });

    if (!homeProgram) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const homeBatch = homeProgram.batches.find((b) => b.batch_code === batchCode);

    if (!homeBatch) {
      return NextResponse.json(
        { error: "Batch not found under this program" },
        { status: 404 }
      );
    }

    const relatedPrograms = relatedProgramCodes.length
      ? await prisma.programs.findMany({
          where: {
            short_name: {
              in: relatedProgramCodes,
            },
          },
          include: {
            batches: {
              orderBy: { batch_code: "asc" },
            },
          },
          orderBy: { short_name: "asc" },
        })
      : [];

    const completed = await prisma.batch_completed_courses.findMany({
      where: { batch_id: homeBatch.id },
      orderBy: { id: "asc" },
    });

    const current = await prisma.batch_current_registrations.findMany({
      where: { batch_id: homeBatch.id },
      include: {
        academic_terms: true,
      },
      orderBy: { id: "asc" },
    });

    const reportLogs = await prisma.student_report_logs.findMany({
      where: {
        student_name: `${homeProgram.short_name} Batch ${homeBatch.batch_code}`,
      },
      orderBy: { created_at: "desc" },
    });

    const latestCompletedFromLogs = getLatestTerm(
      reportLogs.map((r) => r.latest_completed_semester)
    );

    const currentRegistrationTerm = getLatestTerm(
      current.map((r) => r.academic_terms?.name)
    );

    const latestCompletedTerm = latestCompletedFromLogs || null;

    let suggestedOfferingTerm: string | null = null;

    if (currentRegistrationTerm) {
      suggestedOfferingTerm = getNextSemester(currentRegistrationTerm);
    } else if (latestCompletedTerm) {
      suggestedOfferingTerm = getNextSemester(latestCompletedTerm);
    } else if (homeBatch.admission_term) {
      suggestedOfferingTerm = homeBatch.admission_term.toUpperCase();
    }

    const completedByCode = new Set(
      completed.map((c) => normalizeCourseCode(c.course_code))
    );

    const completedByTitle = new Set(
      completed.map((c) => normalizeTitle(c.normalized_title || c.course_title))
    );

    const currentByCode = new Set(
      current.map((c) => normalizeCourseCode(c.course_code))
    );

    const currentByTitle = new Set(
      current.map((c) => normalizeTitle(c.normalized_title || c.course_title))
    );

    const remainingCourses = homeProgram.master_courses.filter((course) => {
      const codeKey = normalizeCourseCode(course.course_code);
      const titleKey = normalizeTitle(course.normalized_title || course.course_title);

      const isCompleted =
        completedByCode.has(codeKey) || completedByTitle.has(titleKey);

      const isCurrent =
        currentByCode.has(codeKey) || currentByTitle.has(titleKey);

      return !isCompleted && !isCurrent;
    });

    const availableBatches = [
      ...homeProgram.batches.map((b) => ({
        id: b.id,
        batch_code: b.batch_code,
        admission_term: b.admission_term,
        program_id: homeProgram.id,
        program_code: homeProgram.short_name,
        program_name: homeProgram.name,
      })),
      ...relatedPrograms.flatMap((p) =>
        p.batches.map((b) => ({
          id: b.id,
          batch_code: b.batch_code,
          admission_term: b.admission_term,
          program_id: p.id,
          program_code: p.short_name,
          program_name: p.name,
        }))
      ),
    ];

    let reusableSections: Array<{
      offered_course_id: number;
      source_program_code: string;
      source_program_name: string;
      course_code: string;
      course_title: string;
      section: string;
      faculty: string;
      batches: string[];
      meetings: string[];
      status: string;
    }> = [];

    if (suggestedOfferingTerm) {
      const suggestedTerm = await prisma.academic_terms.findFirst({
        where: {
          name: suggestedOfferingTerm,
        },
      });

      if (suggestedTerm) {
        const allProgramIds = [homeProgram.id, ...relatedPrograms.map((p) => p.id)];

        const reusableOfferings = await prisma.offerings.findMany({
          where: {
            academic_term_id: suggestedTerm.id,
            program_id: {
              in: allProgramIds,
            },
            status: {
              in: ["DRAFT", "CONFIRMED"],
            },
          },
          include: {
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
            created_at: "asc",
          },
        });

        reusableSections = reusableOfferings.flatMap((offering) =>
          offering.offered_courses.map((course) => ({
            offered_course_id: course.id,
            source_program_code: offering.programs.short_name,
            source_program_name: offering.programs.name,
            course_code: course.master_courses.course_code,
            course_title: course.master_courses.course_title,
            section: course.section,
            faculty: course.offered_course_teachers
              .map((t) => t.teachers?.teacher_code || "-")
              .join(", "),
            batches: course.offered_course_batches.map((b) => b.batches.batch_code),
            meetings: course.offered_course_slots.map(
              (s) => `${s.day_of_week} ${s.start_time}-${s.end_time} (${s.rooms?.room_code || "-"})`
            ),
            status: offering.status,
          }))
        );
      }
    }

    return NextResponse.json({
      success: true,
      program: {
        id: homeProgram.id,
        name: homeProgram.name,
        short_name: homeProgram.short_name,
      },
      batch: {
        id: homeBatch.id,
        batch_code: homeBatch.batch_code,
        admission_term: homeBatch.admission_term,
      },
      relatedPrograms: relatedPrograms.map((p) => ({
        id: p.id,
        short_name: p.short_name,
        name: p.name,
      })),
      availableBatches,
      reusableSections,
      academicProgress: {
        latestCompletedTerm,
        currentRegistrationTerm,
        suggestedOfferingTerm,
      },
      summary: {
        totalCourses: homeProgram.master_courses.length,
        completedCourses: completed.length,
        ongoingCourses: current.length,
        remainingCourses: remainingCourses.length,
      },
      remainingCourses,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load offering context",
      },
      { status: 500 }
    );
  }
}
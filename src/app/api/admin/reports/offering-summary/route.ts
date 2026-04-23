import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

type SummaryRow = {
  programCode: string;
  programName: string;
  totalSections: number;
  totalCourses: number;
  totalCredits: number;
  totalBatchesCovered: number;
  totalFacultyAssigned: number;
  theorySections: number;
  labSections: number;
  projectSections: number;
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isLabLike(courseTitle: string, courseType?: string | null) {
  const title = String(courseTitle || "").toUpperCase();
  const type = String(courseType || "").toUpperCase();
  return title.includes("LAB") || type.includes("LAB");
}

function isProjectLike(courseTitle: string, courseType?: string | null) {
  const title = String(courseTitle || "").toUpperCase();
  const type = String(courseType || "").toUpperCase();
  return (
    title.includes("PROJECT") ||
    title.includes("INTERNSHIP") ||
    title.includes("THESIS") ||
    type.includes("PROJECT")
  );
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const term = await prisma.academic_terms.findFirst({
      where: { name: termName },
      select: { id: true, name: true },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const courses = await prisma.offered_courses.findMany({
      where: {
        offerings: {
          academic_term_id: term.id,
          status: "CONFIRMED",
        },
      },
      include: {
        master_courses: {
          include: {
            program: true,
          },
        },
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
        primary_offered_course: {
          include: {
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
          },
        },
      },
      orderBy: [{ id: "asc" }],
    });

    const byProgram = new Map<string, SummaryRow>();
    const overallPrograms = new Set<string>();
    const overallCourses = new Set<string>();
    const overallBatches = new Set<string>();
    const overallFaculty = new Set<string>();

    let overallSections = 0;
    let overallCredits = 0;
    let overallTheory = 0;
    let overallLab = 0;
    let overallProject = 0;

    for (const course of courses) {
      const programCode = course.master_courses.program.short_name;
      const programName = course.master_courses.program.name;
      const courseKey = `${programCode}::${course.master_courses.course_code}::${course.section}`;

      if (!byProgram.has(programCode)) {
        byProgram.set(programCode, {
          programCode,
          programName,
          totalSections: 0,
          totalCourses: 0,
          totalCredits: 0,
          totalBatchesCovered: 0,
          totalFacultyAssigned: 0,
          theorySections: 0,
          labSections: 0,
          projectSections: 0,
        });
      }

      const row = byProgram.get(programCode)!;
      row.totalSections += 1;
      row.totalCourses += 1;
      row.totalCredits += Number(course.master_courses.credit || 0);

      const batchCodes = uniqueStrings(
        course.offered_course_batches.map((x) => x.batches.batch_code)
      );
      row.totalBatchesCovered += batchCodes.length;

      const effectiveTeachers =
        course.primary_offered_course?.offered_course_teachers.length
          ? course.primary_offered_course.offered_course_teachers
          : course.offered_course_teachers;

      const teacherCodes = uniqueStrings(
        effectiveTeachers.map((x) => x.teachers.teacher_code)
      );
      row.totalFacultyAssigned += teacherCodes.length;

      if (isProjectLike(course.master_courses.course_title, course.master_courses.course_type)) {
        row.projectSections += 1;
        overallProject += 1;
      } else if (isLabLike(course.master_courses.course_title, course.master_courses.course_type)) {
        row.labSections += 1;
        overallLab += 1;
      } else {
        row.theorySections += 1;
        overallTheory += 1;
      }

      overallPrograms.add(programCode);
      overallCourses.add(courseKey);
      overallSections += 1;
      overallCredits += Number(course.master_courses.credit || 0);
      batchCodes.forEach((b) => overallBatches.add(b));
      teacherCodes.forEach((t) => overallFaculty.add(t));
    }

    return NextResponse.json({
      success: true,
      termName: term.name,
      overall: {
        totalPrograms: overallPrograms.size,
        totalSections: overallSections,
        totalCourses: overallCourses.size,
        totalCredits: overallCredits,
        totalBatchesCovered: overallBatches.size,
        totalFacultyAssigned: overallFaculty.size,
        theorySections: overallTheory,
        labSections: overallLab,
        projectSections: overallProject,
      },
      programRows: Array.from(byProgram.values()).sort((a, b) =>
        a.programCode.localeCompare(b.programCode)
      ),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load offering summary." },
      { status: 500 }
    );
  }
}
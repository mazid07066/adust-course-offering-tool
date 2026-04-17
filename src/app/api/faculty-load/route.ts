import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(request.url);

    const programCode = String(searchParams.get("programCode") || "").trim().toUpperCase();
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

    if (!programCode || !termName) {
      return NextResponse.json(
        { error: "programCode and termName are required." },
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

    const term = await prisma.academic_terms.findFirst({
      where: {
        name: termName,
      },
    });

    if (!term) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          facultyCount: 0,
          courseCount: 0,
          totalCredits: 0,
        },
      });
    }

    const offerings = await prisma.offerings.findMany({
      where: {
        program_id: program.id,
        academic_term_id: term.id,
        status: "CONFIRMED",
      },
      include: {
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
            offered_course_batches: {
              include: {
                batches: true,
              },
            },
          },
        },
      },
    });

    type FacultyCourseRow = {
      courseCode: string;
      courseTitle: string;
      section: string;
      credit: number;
      courseType: string;
      batches: string[];
    };

    type FacultyLoadRow = {
      teacherId: number;
      teacherCode: string;
      fullName: string;
      designation: string | null;
      totalCredits: number;
      theoryCredits: number;
      labCredits: number;
      courses: FacultyCourseRow[];
    };

    const facultyMap = new Map<number, FacultyLoadRow>();

    for (const offering of offerings) {
      for (const course of offering.offered_courses) {
        const batches = course.offered_course_batches.map((b) => b.batches.batch_code);
        const credit = Number(course.master_courses.credit || 0);
        const courseType = String(course.master_courses.course_type || "").toUpperCase();

        for (const assigned of course.offered_course_teachers) {
          const teacher = assigned.teachers;
          if (!teacher) continue;

          if (!facultyMap.has(teacher.id)) {
            facultyMap.set(teacher.id, {
              teacherId: teacher.id,
              teacherCode: teacher.teacher_code,
              fullName: teacher.full_name,
              designation: teacher.designation,
              totalCredits: 0,
              theoryCredits: 0,
              labCredits: 0,
              courses: [],
            });
          }

          const row = facultyMap.get(teacher.id)!;

          row.totalCredits += credit;

          if (courseType === "LAB") {
            row.labCredits += credit;
          } else {
            row.theoryCredits += credit;
          }

          row.courses.push({
            courseCode: course.master_courses.course_code,
            courseTitle: course.master_courses.course_title,
            section: course.section,
            credit,
            courseType,
            batches,
          });
        }
      }
    }

    const data = Array.from(facultyMap.values()).sort((a, b) =>
      a.teacherCode.localeCompare(b.teacherCode)
    );

    const courseCount = data.reduce((sum, faculty) => sum + faculty.courses.length, 0);
    const totalCredits = data.reduce((sum, faculty) => sum + faculty.totalCredits, 0);

    return NextResponse.json({
      success: true,
      data,
      summary: {
        facultyCount: data.length,
        courseCount,
        totalCredits,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load faculty load report.",
      },
      { status: 500 }
    );
  }
}
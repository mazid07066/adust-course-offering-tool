import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programCode = String(searchParams.get("programCode") || "")
      .trim()
      .toUpperCase();

    if (!programCode) {
      const allCourses = await prisma.master_courses.findMany({
        orderBy: [{ course_code: "asc" }],
      });

      return NextResponse.json({
        items: allCourses.map((course) => ({
          id: course.id,
          curriculumKey: course.curriculum_key,
          courseCode: course.course_code,
          courseTitle: course.course_title,
          credit: course.credit,
          courseType: course.course_type,
          levelTerm: course.level_term,
          groupName: course.group_name,
          isActive: course.is_active,
        })),
      });
    }

    const academicIdentity = await prisma.academic_catalog_entries.findFirst({
      where: {
        program_code: programCode,
        is_active: true,
      },
    });

    if (!academicIdentity) {
      return NextResponse.json(
        { error: "Academic identity not found." },
        { status: 404 }
      );
    }

    let courses = [];

    if (academicIdentity.curriculum_key) {
      courses = await prisma.master_courses.findMany({
        where: {
          curriculum_key: academicIdentity.curriculum_key,
        },
        orderBy: [{ course_code: "asc" }],
      });
    } else {
      const program = await prisma.programs.findFirst({
        where: {
          short_name: academicIdentity.program_code,
        },
      });

      courses = program
        ? await prisma.master_courses.findMany({
            where: {
              program_id: program.id,
            },
            orderBy: [{ course_code: "asc" }],
          })
        : [];
    }

    return NextResponse.json({
      selectedProgram: {
        programCode: academicIdentity.program_code,
        displayLabel: academicIdentity.display_label,
        curriculumKey: academicIdentity.curriculum_key,
      },
      items: courses.map((course) => ({
        id: course.id,
        curriculumKey: course.curriculum_key,
        courseCode: course.course_code,
        courseTitle: course.course_title,
        credit: course.credit,
        courseType: course.course_type,
        levelTerm: course.level_term,
        groupName: course.group_name,
        isActive: course.is_active,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load courses.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const termName = String(body.termName || "").trim().toUpperCase();
    const programIds = Array.isArray(body.programIds)
      ? body.programIds.map(Number).filter((x: number) => Number.isFinite(x))
      : [];

    const statuses = Array.isArray(body.statuses) && body.statuses.length > 0
      ? body.statuses.map((x: string) => String(x).trim())
      : ["FACULTY_CHOICE_BUFFER", "FACULTY_CHOICE_FINALIZED", "CONFIRMED"];

    if (!termName) {
      return NextResponse.json(
        { error: "Academic term is required." },
        { status: 400 }
      );
    }

    if (programIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one program." },
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
          status: {
            in: statuses,
          },
        },
        master_courses: {
          program_id: {
            in: programIds,
          },
        },
      },
      orderBy: [
        { master_courses: { program_id: "asc" } },
        { section: "asc" },
        { id: "asc" },
      ],
      include: {
        offerings: true,
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
        primary_offered_course: {
          include: {
            master_courses: true,
          },
        },
      },
    });

    const rows = courses.map((course) => {
      const batchCodes = uniqueStrings(
        course.offered_course_batches.map((row) => row.batches.batch_code)
      );

      return {
        offeredCourseId: course.id,
        programId: course.master_courses.program_id,
        programCode: course.master_courses.program.short_name,
        programName: course.master_courses.program.name,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        section: course.section,
        batchCodes,
        studentCount: 0,
        role: course.primary_offered_course_id ? "SECONDARY" : "PRIMARY",
        primaryReference: course.primary_offered_course_id
          ? `${course.primary_offered_course?.master_courses?.course_code || "-"} Sec-${course.primary_offered_course?.section || "-"}`
          : "-",
        offeringStatus: course.offerings.status,
      };
    });

    return NextResponse.json({
      success: true,
      termName: term.name,
      rows,
    });
  } catch (error) {
    console.error("Exam scheduler course loading error:", error);
    return NextResponse.json(
      { error: "Failed to load offered course sections for exam scheduling." },
      { status: 500 }
    );
  }
}
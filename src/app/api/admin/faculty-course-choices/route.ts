import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

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

    const selections = await prisma.faculty_course_selections.findMany({
      where: {
        academic_term_id: term.id,
      },
      orderBy: [
        { teacher_id: "asc" },
        { priority_order: "asc" },
        { id: "asc" },
      ],
      include: {
        teachers: true,
        offered_courses: {
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
          },
        },
      },
    });

    const groupedMap = new Map<
      number,
      {
        teacherId: number;
        teacherCode: string;
        teacherName: string;
        designation: string | null;
        totalChoices: number;
        finalizedCount: number;
        bufferCount: number;
        choices: Array<{
          selectionId: number;
          offeredCourseId: number;
          priorityOrder: number | null;
          status: string;
          selectedAt: Date | null;
          confirmedAt: Date | null;
          programCode: string;
          courseCode: string;
          courseTitle: string;
          section: string;
          batchCodes: string[];
        }>;
      }
    >();

    for (const row of selections) {
      if (!groupedMap.has(row.teacher_id)) {
        groupedMap.set(row.teacher_id, {
          teacherId: row.teacher_id,
          teacherCode: row.teachers.teacher_code,
          teacherName: row.teachers.full_name,
          designation: row.teachers.designation,
          totalChoices: 0,
          finalizedCount: 0,
          bufferCount: 0,
          choices: [],
        });
      }

      const item = groupedMap.get(row.teacher_id)!;

      item.totalChoices += 1;
      if (row.status === "FINAL") {
        item.finalizedCount += 1;
      } else {
        item.bufferCount += 1;
      }

      item.choices.push({
        selectionId: row.id,
        offeredCourseId: row.offered_course_id,
        priorityOrder: row.priority_order,
        status: row.status,
        selectedAt: row.selected_at,
        confirmedAt: row.confirmed_at,
        programCode: row.offered_courses.master_courses.program.short_name,
        courseCode: row.offered_courses.master_courses.course_code,
        courseTitle: row.offered_courses.master_courses.course_title,
        section: row.offered_courses.section,
        batchCodes: row.offered_courses.offered_course_batches.map(
          (x) => x.batches.batch_code
        ),
      });
    }

    const facultyChoices = Array.from(groupedMap.values()).map((group) => ({
      teacherId: group.teacherId,
      teacherCode: group.teacherCode,
      teacherName: group.teacherName,
      designation: group.designation,
      totalChoices: group.totalChoices,
      finalizedCount: group.finalizedCount,
      bufferCount: group.bufferCount,
      choices: group.choices.map((choice) => ({
        ...choice,
        selectedAt: choice.selectedAt ? choice.selectedAt.toISOString() : null,
        confirmedAt: choice.confirmedAt ? choice.confirmedAt.toISOString() : null,
      })),
    }));

    return NextResponse.json({
      success: true,
      termName: term.name,
      facultyChoices,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load admin faculty course choices." },
      { status: 500 }
    );
  }
}
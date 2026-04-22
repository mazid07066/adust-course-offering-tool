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
      orderBy: [
        { teacher_id: "asc" },
        { priority_order: "asc" },
        { id: "asc" },
      ],
    });

    const map = new Map<
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
          selectedAt: string | null;
          confirmedAt: string | null;
          programCode: string;
          courseCode: string;
          courseTitle: string;
          section: string;
          batchCodes: string[];
        }>;
      }
    >();

    for (const row of selections) {
      if (!map.has(row.teacher_id)) {
        map.set(row.teacher_id, {
          teacherId: row.teacher_id,
          teacherCode: row.teachers?.teacher_code || "-",
          teacherName: row.teachers?.full_name || "-",
          designation: row.teachers?.designation || null,
          totalChoices: 0,
          finalizedCount: 0,
          bufferCount: 0,
          choices: [],
        });
      }

      const group = map.get(row.teacher_id)!;
      group.totalChoices += 1;

      if (row.status === "FINAL") group.finalizedCount += 1;
      if (row.status === "BUFFER") group.bufferCount += 1;

      group.choices.push({
        selectionId: row.id,
        offeredCourseId: row.offered_course_id,
        priorityOrder: row.priority_order,
        status: row.status,
        selectedAt: row.selected_at ? row.selected_at.toISOString() : null,
        confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
        programCode: row.offered_courses.master_courses.program.short_name,
        courseCode: row.offered_courses.master_courses.course_code,
        courseTitle: row.offered_courses.master_courses.course_title,
        section: row.offered_courses.section,
        batchCodes: row.offered_courses.offered_course_batches.map(
          (x) => x.batches.batch_code
        ),
      });
    }

    return NextResponse.json({
      success: true,
      termName: term.name,
      facultyChoices: Array.from(map.values()),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculty course choices." },
      { status: 500 }
    );
  }
}
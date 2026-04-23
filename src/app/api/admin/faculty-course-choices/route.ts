import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

type ChoiceRow = {
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
};

type AssignmentRow = {
  assignmentId: number;
  offeredCourseId: number;
  programCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  batchCodes: string[];
  assignedCredit: number;
  loadType: string;
};

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

    const [selections, assignments] = await Promise.all([
      prisma.faculty_course_selections.findMany({
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
      }),
      prisma.offered_course_teachers.findMany({
        where: {
          offered_courses: {
            offerings: {
              academic_term_id: term.id,
            },
          },
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
        orderBy: [{ teacher_id: "asc" }, { id: "asc" }],
      }),
    ]);

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
        approvedAssignedCount: number;
        approvedAssignedCredits: number;
        choices: ChoiceRow[];
        assignments: AssignmentRow[];
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
          approvedAssignedCount: 0,
          approvedAssignedCredits: 0,
          choices: [],
          assignments: [],
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

    for (const row of assignments) {
      if (!map.has(row.teacher_id)) {
        map.set(row.teacher_id, {
          teacherId: row.teacher_id,
          teacherCode: row.teachers?.teacher_code || "-",
          teacherName: row.teachers?.full_name || "-",
          designation: row.teachers?.designation || null,
          totalChoices: 0,
          finalizedCount: 0,
          bufferCount: 0,
          approvedAssignedCount: 0,
          approvedAssignedCredits: 0,
          choices: [],
          assignments: [],
        });
      }

      const group = map.get(row.teacher_id)!;
      group.approvedAssignedCount += 1;
      group.approvedAssignedCredits += Number(row.assigned_credit || 0);

      group.assignments.push({
        assignmentId: row.id,
        offeredCourseId: row.offered_course_id,
        programCode: row.offered_courses.master_courses.program.short_name,
        courseCode: row.offered_courses.master_courses.course_code,
        courseTitle: row.offered_courses.master_courses.course_title,
        section: row.offered_courses.section,
        batchCodes: row.offered_courses.offered_course_batches.map(
          (x) => x.batches.batch_code
        ),
        assignedCredit: Number(row.assigned_credit || 0),
        loadType: row.load_type,
      });
    }

    return NextResponse.json({
      success: true,
      termName: term.name,
      facultyChoices: Array.from(map.values()).sort((a, b) =>
        a.teacherCode.localeCompare(b.teacherCode)
      ),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculty course choices." },
      { status: 500 }
    );
  }
}
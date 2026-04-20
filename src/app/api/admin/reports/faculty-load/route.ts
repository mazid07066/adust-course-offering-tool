import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getFacultyLoadLevel,
  getFacultyLoadMessage,
} from "@/lib/faculty-assignment-policy";

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

    const assignments = await prisma.offered_course_teachers.findMany({
      where: {
        offered_courses: {
          primary_offered_course_id: null,
          offerings: {
            academic_term_id: term.id,
            status: "CONFIRMED",
          },
        },
      },
      orderBy: [
        { teacher_id: "asc" },
        { offered_course_id: "asc" },
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
            secondary_offered_courses: {
              include: {
                master_courses: {
                  include: {
                    program: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const grouped = new Map<
      number,
      {
        teacherId: number;
        teacherCode: string;
        teacherName: string;
        designation: string | null;
        totalAssignedCredits: number;
        totalAssignedSections: number;
        items: Array<{
          offeredCourseId: number;
          courseCode: string;
          courseTitle: string;
          section: string;
          programCode: string;
          assignedCredit: number;
          batchCodes: string[];
          linkedSecondaryCourseCodes: string[];
        }>;
      }
    >();

    for (const row of assignments) {
      if (!grouped.has(row.teacher_id)) {
        grouped.set(row.teacher_id, {
          teacherId: row.teacher_id,
          teacherCode: row.teachers.teacher_code,
          teacherName: row.teachers.full_name,
          designation: row.teachers.designation,
          totalAssignedCredits: 0,
          totalAssignedSections: 0,
          items: [],
        });
      }

      const group = grouped.get(row.teacher_id)!;

      group.totalAssignedCredits += Number(row.assigned_credit || 0);
      group.totalAssignedSections += 1;
      group.items.push({
        offeredCourseId: row.offered_course_id,
        courseCode: row.offered_courses.master_courses.course_code,
        courseTitle: row.offered_courses.master_courses.course_title,
        section: row.offered_courses.section,
        programCode: row.offered_courses.master_courses.program.short_name,
        assignedCredit: Number(row.assigned_credit || 0),
        batchCodes: row.offered_courses.offered_course_batches.map(
          (x) => x.batches.batch_code
        ),
        linkedSecondaryCourseCodes:
          row.offered_courses.secondary_offered_courses.map(
            (secondary) => secondary.master_courses.course_code
          ),
      });
    }

    const rows = Array.from(grouped.values())
      .sort((a, b) => a.teacherCode.localeCompare(b.teacherCode))
      .map((row) => ({
        ...row,
        loadLevel: getFacultyLoadLevel(row.totalAssignedCredits),
        loadMessage: getFacultyLoadMessage(row.totalAssignedCredits),
      }));

    return NextResponse.json({
      success: true,
      termName: term.name,
      summary: {
        totalTeachers: rows.length,
        totalAssignedSections: rows.reduce(
          (sum, row) => sum + row.totalAssignedSections,
          0
        ),
        totalAssignedCredits: rows.reduce(
          (sum, row) => sum + row.totalAssignedCredits,
          0
        ),
      },
      rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculty load report." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { normalizeReportParam } from "@/lib/report-visible-statuses";

type FacultyLoadItem = {
  assignmentId: number;
  offeredCourseId: number;
  offeringStatus: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  programCode: string;
  assignedCredit: number;
  loadType: string;
  batchCodes: string[];
  linkedSecondaryCourseCodes: string[];
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getFacultyLoadLevel(totalCredits: number) {
  if (totalCredits > 18) return "OVERLOAD";
  if (totalCredits < 9) return "UNDERLOAD";
  return "NORMAL";
}

function getFacultyLoadMessage(totalCredits: number) {
  if (totalCredits > 18) {
    return "Faculty load is above maximum recommended credit limit.";
  }

  if (totalCredits < 9) {
    return "Faculty load is below minimum recommended credit limit.";
  }

  return "Faculty load is within normal range.";
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const termName = normalizeReportParam(searchParams.get("termName"));
    const programCode = normalizeReportParam(searchParams.get("programCode"));
    const batchCode = normalizeReportParam(searchParams.get("batchCode"));
    const teacherId = Number(searchParams.get("teacherId") || 0);

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
        ...(teacherId ? { teacher_id: teacherId } : {}),
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
          },
          ...(programCode
            ? {
                master_courses: {
                  program: {
                    short_name: programCode,
                  },
                },
              }
            : {}),
          ...(batchCode
            ? {
                offered_course_batches: {
                  some: {
                    batches: {
                      batch_code: batchCode,
                    },
                  },
                },
              }
            : {}),
        },
      },
      orderBy: [
        { teacher_id: "asc" },
        { offered_course_id: "asc" },
        { id: "asc" },
      ],
      include: {
        teachers: true,
        offered_courses: {
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
            secondary_offered_courses: {
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
            primary_offered_course: {
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

    const allAssignmentsForOptions = await prisma.offered_course_teachers.findMany({
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
      orderBy: [
        { teacher_id: "asc" },
        { offered_course_id: "asc" },
        { id: "asc" },
      ],
    });

    const teacherOptionMap = new Map<
      number,
      {
        teacherId: number;
        teacherCode: string;
        teacherName: string;
      }
    >();

    const programOptionMap = new Map<
      string,
      {
        programCode: string;
        programName: string;
      }
    >();

    const batchOptionSet = new Set<string>();

    for (const row of allAssignmentsForOptions) {
      teacherOptionMap.set(row.teacher_id, {
        teacherId: row.teacher_id,
        teacherCode: row.teachers.teacher_code,
        teacherName: row.teachers.full_name,
      });

      programOptionMap.set(row.offered_courses.master_courses.program.short_name, {
        programCode: row.offered_courses.master_courses.program.short_name,
        programName: row.offered_courses.master_courses.program.name,
      });

      for (const batchRow of row.offered_courses.offered_course_batches) {
        batchOptionSet.add(batchRow.batches.batch_code);
      }
    }

    const grouped = new Map<
      number,
      {
        teacherId: number;
        teacherCode: string;
        teacherName: string;
        designation: string | null;
        totalAssignedCredits: number;
        totalAssignedSections: number;
        loadLevel: string;
        loadMessage: string;
        items: FacultyLoadItem[];
      }
    >();

    for (const row of assignments) {
      const groupKey = row.teacher_id;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          teacherId: row.teacher_id,
          teacherCode: row.teachers.teacher_code,
          teacherName: row.teachers.full_name,
          designation: row.teachers.designation,
          totalAssignedCredits: 0,
          totalAssignedSections: 0,
          loadLevel: "NORMAL",
          loadMessage: "",
          items: [],
        });
      }

      const group = grouped.get(groupKey)!;
      const credit = Number(row.assigned_credit || 0);

      group.totalAssignedCredits = Number(
        (group.totalAssignedCredits + credit).toFixed(2)
      );
      group.totalAssignedSections += 1;

      group.items.push({
        assignmentId: row.id,
        offeredCourseId: row.offered_course_id,
        offeringStatus: row.offered_courses.offerings.status,
        courseCode: row.offered_courses.master_courses.course_code,
        courseTitle: row.offered_courses.master_courses.course_title,
        section: row.offered_courses.section,
        programCode: row.offered_courses.master_courses.program.short_name,
        assignedCredit: credit,
        loadType: row.load_type,
        batchCodes: uniqueStrings(
          row.offered_courses.offered_course_batches.map(
            (x) => x.batches.batch_code
          )
        ),
        linkedSecondaryCourseCodes: uniqueStrings(
          row.offered_courses.secondary_offered_courses.map(
            (secondary) =>
              `${secondary.master_courses.program.short_name}:${secondary.master_courses.course_code}`
          )
        ),
      });
    }

    const rows = Array.from(grouped.values()).map((row) => ({
      ...row,
      loadLevel: getFacultyLoadLevel(row.totalAssignedCredits),
      loadMessage: getFacultyLoadMessage(row.totalAssignedCredits),
      items: row.items.sort((a, b) => {
        if (a.programCode !== b.programCode) {
          return a.programCode.localeCompare(b.programCode);
        }

        if (a.courseCode !== b.courseCode) {
          return a.courseCode.localeCompare(b.courseCode);
        }

        return a.section.localeCompare(b.section);
      }),
    }));

    rows.sort((a, b) => a.teacherCode.localeCompare(b.teacherCode));

    return NextResponse.json({
      success: true,
      termName: term.name,
      filters: {
        teacherId: teacherId || null,
        programCode,
        batchCode,
      },
      teacherOptions: Array.from(teacherOptionMap.values()).sort((a, b) =>
        a.teacherCode.localeCompare(b.teacherCode)
      ),
      programOptions: Array.from(programOptionMap.values()).sort((a, b) =>
        a.programCode.localeCompare(b.programCode)
      ),
      batchOptions: Array.from(batchOptionSet).sort((a, b) =>
        a.localeCompare(b)
      ),
      summary: {
        totalTeachers: rows.length,
        totalAssignedSections: rows.reduce(
          (sum, row) => sum + row.totalAssignedSections,
          0
        ),
        totalAssignedCredits: Number(
          rows
            .reduce((sum, row) => sum + row.totalAssignedCredits, 0)
            .toFixed(2)
        ),
      },
      rows,
    });
  } catch (error) {
    console.error("Faculty load report error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load faculty load report.",
      },
      { status: 500 }
    );
  }
}
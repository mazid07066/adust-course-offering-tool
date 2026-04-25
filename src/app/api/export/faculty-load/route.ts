import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { normalizeReportParam } from "@/lib/report-visible-statuses";

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
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
              },
            },
          },
        },
      },
    });

    const headers = [
      "Teacher Code",
      "Teacher Name",
      "Designation",
      "Offering Status",
      "Program",
      "Course Code",
      "Course Title",
      "Section",
      "Load Type",
      "Assigned Credit",
      "Batches",
      "Linked Secondary Courses",
    ];

    const lines = [headers.map(csvEscape).join(",")];

    for (const row of assignments) {
      lines.push(
        [
          row.teachers.teacher_code,
          row.teachers.full_name,
          row.teachers.designation || "-",
          row.offered_courses.offerings.status,
          row.offered_courses.master_courses.program.short_name,
          row.offered_courses.master_courses.course_code,
          row.offered_courses.master_courses.course_title,
          row.offered_courses.section,
          row.load_type,
          Number(row.assigned_credit || 0),
          uniqueStrings(
            row.offered_courses.offered_course_batches.map(
              (x) => x.batches.batch_code
            )
          ).join(", "),
          uniqueStrings(
            row.offered_courses.secondary_offered_courses.map(
              (secondary) =>
                `${secondary.master_courses.program.short_name}:${secondary.master_courses.course_code}`
            )
          ).join(", "),
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    const filterPart = [
      term.name.replace(/\s+/g, "_"),
      teacherId ? `TEACHER_${teacherId}` : "ALL_FACULTY",
      programCode || "ALL_PROGRAMS",
      batchCode || "ALL_BATCHES",
    ].join("_");

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="faculty_load_${filterPart}.csv"`,
      },
    });
  } catch (error) {
    console.error("Faculty load export error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export faculty load report.",
      },
      { status: 500 }
    );
  }
}
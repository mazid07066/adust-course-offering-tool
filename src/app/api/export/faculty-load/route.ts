import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getFacultyLoadLevel,
  getFacultyLoadMessage,
} from "@/lib/faculty-assignment-policy";

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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
                master_courses: true,
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
      "Course Code",
      "Course Title",
      "Section",
      "Program",
      "Assigned Credit",
      "Batches",
      "Linked Secondary Courses",
      "Load Level",
      "Load Message",
    ];

    const teacherCreditMap = new Map<number, number>();
    for (const row of assignments) {
      teacherCreditMap.set(
        row.teacher_id,
        (teacherCreditMap.get(row.teacher_id) || 0) + Number(row.assigned_credit || 0)
      );
    }

    const lines = [headers.map(csvEscape).join(",")];

    for (const row of assignments) {
      const totalAssignedCredits = teacherCreditMap.get(row.teacher_id) || 0;

      lines.push(
        [
          row.teachers.teacher_code,
          row.teachers.full_name,
          row.teachers.designation || "-",
          row.offered_courses.master_courses.course_code,
          row.offered_courses.master_courses.course_title,
          row.offered_courses.section,
          row.offered_courses.master_courses.program.short_name,
          Number(row.assigned_credit || 0),
          row.offered_courses.offered_course_batches
            .map((x) => x.batches.batch_code)
            .join(", "),
          row.offered_courses.secondary_offered_courses
            .map((secondary) => secondary.master_courses.course_code)
            .join(", "),
          getFacultyLoadLevel(totalAssignedCredits),
          getFacultyLoadMessage(totalAssignedCredits),
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="faculty_load_${term.name.replace(/\s+/g, "_")}.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to export faculty load report." },
      { status: 500 }
    );
  }
}
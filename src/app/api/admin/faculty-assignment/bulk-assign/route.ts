import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ALLOWED_OFFERING_STATUSES = [
  "DRAFT",
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();
    const termName = String(body.termName || "").trim().toUpperCase();
    const mode = String(body.mode || "FINAL_ONLY").trim().toUpperCase();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    if (!["FINAL_ONLY", "FINAL_THEN_BUFFER"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid bulk assign mode." },
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
        primary_offered_course_id: null,
        offerings: {
          academic_term_id: term.id,
          status: {
            in: ALLOWED_OFFERING_STATUSES,
          },
        },
      },
      include: {
        master_courses: true,
        offered_course_teachers: true,
      },
      orderBy: [{ id: "asc" }],
    });

    let assignedCount = 0;
    let skippedAlreadyAssigned = 0;
    let skippedNoFacultyChoice = 0;

    for (const course of courses) {
      if (course.offered_course_teachers.length > 0) {
        skippedAlreadyAssigned += 1;
        continue;
      }

      const candidateSelections = await prisma.faculty_course_selections.findMany({
        where: {
          offered_course_id: course.id,
          academic_term_id: term.id,
          status:
            mode === "FINAL_ONLY"
              ? "FINAL"
              : {
                  in: ["FINAL", "BUFFER"],
                },
        },
        include: {
          teachers: true,
        },
        orderBy: [
          { status: "asc" },
          { priority_order: "asc" },
          { id: "asc" },
        ],
      });

      const activeCandidates = candidateSelections.filter(
        (row) => row.teachers.is_active
      );

      const sortedCandidates = [...activeCandidates].sort((a, b) => {
        if (a.status === b.status) {
          return (a.priority_order || 9999) - (b.priority_order || 9999);
        }
        if (a.status === "FINAL" && b.status !== "FINAL") return -1;
        if (a.status !== "FINAL" && b.status === "FINAL") return 1;
        return 0;
      });

      const winner = sortedCandidates[0];

      if (!winner) {
        skippedNoFacultyChoice += 1;
        continue;
      }

      await prisma.offered_course_teachers.create({
        data: {
          offered_course_id: course.id,
          teacher_id: winner.teacher_id,
          assigned_credit: Number(course.master_courses.credit || 0),
          load_type: "BULK_ASSIGNMENT",
        },
      });

      assignedCount += 1;
    }

    return NextResponse.json({
      success: true,
      message: `Bulk assignment completed. Assigned ${assignedCount}, skipped already assigned ${skippedAlreadyAssigned}, skipped no faculty choice ${skippedNoFacultyChoice}.`,
      assignedCount,
      skippedAlreadyAssigned,
      skippedNoFacultyChoice,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to execute bulk assignment." },
      { status: 500 }
    );
  }
}
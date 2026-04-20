import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { cookies } from "next/headers";
import { canFacultyEdit } from "@/lib/faculty-access";

const ALLOWED_OFFERING_STATUSES = [
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export async function POST(req: NextRequest) {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        { error: "Faculty account is not linked to a faculty record." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("sessionToken")?.value || "";

    const access = await canFacultyEdit(sessionToken);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.message || "Faculty editing is not allowed." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const termName = String(body.termName || "").trim().toUpperCase();
    const offeredCourseIdsRaw = Array.isArray(body.offeredCourseIds)
      ? body.offeredCourseIds
      : [];

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const offeredCourseIds = offeredCourseIdsRaw.map((x: unknown) => Number(x));

    if (offeredCourseIds.some((id: number) => !Number.isFinite(id) || id <= 0)) {
      return NextResponse.json(
        { error: "Invalid offeredCourseIds payload." },
        { status: 400 }
      );
    }

    const duplicateCheck = new Set<number>();
    for (const id of offeredCourseIds) {
      if (duplicateCheck.has(id)) {
        return NextResponse.json(
          { error: "Duplicate offered course found in selection list." },
          { status: 400 }
        );
      }
      duplicateCheck.add(id);
    }

    const teacherId = guard.teacher_id;

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

    const existingFinal = await prisma.faculty_course_selections.findFirst({
      where: {
        teacher_id: teacherId,
        academic_term_id: term.id,
        status: "FINAL",
      },
      select: { id: true },
    });

    if (existingFinal) {
      return NextResponse.json(
        { error: "Final submission already completed. Editing is locked." },
        { status: 400 }
      );
    }

    const selectedCourses = offeredCourseIds.length
      ? await prisma.offered_courses.findMany({
          where: {
            id: {
              in: offeredCourseIds,
            },
            primary_offered_course_id: null,
            offerings: {
              academic_term_id: term.id,
              status: {
                in: ALLOWED_OFFERING_STATUSES,
              },
            },
          },
          select: {
            id: true,
          },
        })
      : [];

    if (selectedCourses.length !== offeredCourseIds.length) {
      return NextResponse.json(
        { error: "One or more selected courses are invalid for the selected term." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.faculty_course_selections.deleteMany({
        where: {
          teacher_id: teacherId,
          academic_term_id: term.id,
          status: "BUFFER",
          offered_course_id: {
            notIn: offeredCourseIds.length > 0 ? offeredCourseIds : [-1],
          },
        },
      });

      for (let index = 0; index < offeredCourseIds.length; index += 1) {
        const offeredCourseId = offeredCourseIds[index];
        const priorityOrder = index + 1;

        await tx.faculty_course_selections.upsert({
          where: {
            offered_course_id_teacher_id: {
              offered_course_id: offeredCourseId,
              teacher_id: teacherId,
            },
          },
          update: {
            academic_term_id: term.id,
            priority_order: priorityOrder,
            status: "BUFFER",
            confirmed_at: null,
          },
          create: {
            offered_course_id: offeredCourseId,
            teacher_id: teacherId,
            academic_term_id: term.id,
            priority_order: priorityOrder,
            status: "BUFFER",
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Choice buffer saved successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save faculty choice buffer." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { cookies } from "next/headers";
import { canFacultyEdit } from "@/lib/faculty-access";
import {
  getFacultyLevelCreditPolicy,
  getActiveFacultySeniorityLevel,
} from "@/lib/system-settings";

const ALLOWED_OFFERING_STATUSES = ["FACULTY_CHOICE_BUFFER"];

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
    const sessionToken = cookieStore.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Faculty session token is missing." },
        { status: 401 }
      );
    }

    const access = await canFacultyEdit(sessionToken);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.message || "Editing not allowed." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const termName = String(body.termName || "").trim().toUpperCase();
    const offeredCourseIds = Array.isArray(body.offeredCourseIds)
      ? body.offeredCourseIds.map((x: unknown) => Number(x)).filter(Boolean)
      : [];

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const teacher = await prisma.teachers.findUnique({
      where: { id: guard.teacher_id },
      select: {
        id: true,
        seniority_level: true,
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "Faculty record not found." },
        { status: 404 }
      );
    }

    const activeSeniorityLevel = await getActiveFacultySeniorityLevel();
    const seniorityAllowed =
      !activeSeniorityLevel ||
      teacher.seniority_level === null ||
      teacher.seniority_level === activeSeniorityLevel;

    if (!seniorityAllowed) {
      return NextResponse.json(
        { error: "Your seniority level is not active for faculty choice right now." },
        { status: 403 }
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

    const existingFinal = await prisma.faculty_course_selections.findFirst({
      where: {
        teacher_id: teacher.id,
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
            master_courses: {
              select: {
                credit: true,
              },
            },
          },
        })
      : [];

    if (selectedCourses.length !== offeredCourseIds.length) {
      return NextResponse.json(
        { error: "One or more selected courses are invalid for the selected term." },
        { status: 400 }
      );
    }

    const totalCredits = selectedCourses.reduce(
      (sum, row) => sum + Number(row.master_courses.credit || 0),
      0
    );

    const creditPolicy = await getFacultyLevelCreditPolicy(teacher.seniority_level);

    if (
      creditPolicy?.maxCredits !== null &&
      creditPolicy?.maxCredits !== undefined &&
      totalCredits > creditPolicy.maxCredits
    ) {
      return NextResponse.json(
        {
          error: `Selected credits ${totalCredits} exceed the maximum allowed ${creditPolicy.maxCredits} for your seniority level.`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.faculty_course_selections.deleteMany({
        where: {
          teacher_id: teacher.id,
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
              teacher_id: teacher.id,
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
            teacher_id: teacher.id,
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
      totalCredits,
      creditPolicy,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save faculty choice buffer." },
      { status: 500 }
    );
  }
}
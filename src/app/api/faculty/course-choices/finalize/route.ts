import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { cookies } from "next/headers";
import { canFacultyEdit } from "@/lib/faculty-access";
import {
  getFacultyLevelCreditPolicy,
  getActiveFacultySeniorityLevel,
} from "@/lib/system-settings";

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

    const currentBufferSelections = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
        status: "BUFFER",
      },
      orderBy: [{ priority_order: "asc" }, { id: "asc" }],
      include: {
        offered_courses: {
          include: {
            offerings: true,
            master_courses: {
              select: {
                credit: true,
              },
            },
          },
        },
      },
    });

    if (currentBufferSelections.length === 0) {
      return NextResponse.json(
        { error: "No buffered choices found to finalize." },
        { status: 400 }
      );
    }

    const invalidSelections = currentBufferSelections.filter(
      (row) => row.offered_courses.offerings.status !== "FACULTY_CHOICE_BUFFER"
    );

    if (invalidSelections.length > 0) {
      return NextResponse.json(
        { error: "One or more buffered choices are no longer in active faculty choice stage." },
        { status: 400 }
      );
    }

    const totalCredits = currentBufferSelections.reduce(
      (sum, row) => sum + Number(row.offered_courses.master_courses.credit || 0),
      0
    );

    const creditPolicy = await getFacultyLevelCreditPolicy(teacher.seniority_level);

    if (
      creditPolicy?.minCredits !== null &&
      creditPolicy?.minCredits !== undefined &&
      totalCredits < creditPolicy.minCredits
    ) {
      return NextResponse.json(
        {
          error: `Selected credits ${totalCredits} are below the minimum required ${creditPolicy.minCredits} for your seniority level.`,
        },
        { status: 400 }
      );
    }

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

    await prisma.faculty_course_selections.updateMany({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
        status: "BUFFER",
      },
      data: {
        status: "FINAL",
        confirmed_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Final choice submission completed successfully.",
      totalCredits,
      creditPolicy,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to finalize faculty choices." },
      { status: 500 }
    );
  }
}
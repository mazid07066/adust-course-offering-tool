import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { canFacultyEdit } from "@/lib/faculty-access";
import { validateFacultySession } from "@/lib/faculty-session";
import { getFacultyLevelCreditPolicy } from "@/lib/system-settings";
import { createFacultyNotification } from "@/lib/faculty-notifications";

export async function POST(req: NextRequest) {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        { error: "Faculty account is not linked to a teacher record." },
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

    const sessionCheck = await validateFacultySession(sessionToken);

    if (!sessionCheck.valid || !sessionCheck.session) {
      return NextResponse.json(
        { error: sessionCheck.message || "Faculty session is invalid." },
        { status: 401 }
      );
    }

    const teacher = await prisma.teachers.findUnique({
      where: { id: guard.teacher_id },
      select: {
        id: true,
        teacher_code: true,
        full_name: true,
        seniority_level: true,
        is_active: true,
      },
    });

    if (!teacher || !teacher.is_active) {
      return NextResponse.json(
        { error: "Faculty record is inactive or missing." },
        { status: 403 }
      );
    }

    const editAccess = await canFacultyEdit(sessionToken, {
      id: teacher.id,
      seniority_level: teacher.seniority_level,
    });

    if (!editAccess.allowed) {
      return NextResponse.json(
        { error: editAccess.message || "You are not the active faculty turn." },
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
      orderBy: [{ priority_order: "asc" }, { id: "asc" }],
    });

    if (currentBufferSelections.length === 0) {
      return NextResponse.json(
        { error: "No buffered choices found to finalize." },
        { status: 400 }
      );
    }

    const invalidSelections = currentBufferSelections.filter(
      (row) =>
        !["FACULTY_CHOICE_BUFFER", "FACULTY_CHOICE_FINALIZED"].includes(
          row.offered_courses.offerings.status
        )
    );

    if (invalidSelections.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more buffered choices are no longer available for faculty choice.",
        },
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
          error: `Selected credits ${totalCredits} are below your required minimum ${creditPolicy.minCredits}.`,
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
          error: `Selected credits ${totalCredits} exceed your allowed maximum ${creditPolicy.maxCredits}.`,
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

    await createFacultyNotification({
      recipientUserId: guard.id,
      recipientTeacherId: teacher.id,
      eventType: "FACULTY_CHOICE_FINAL_SUBMITTED",
      title: "Faculty choice final submission completed",
      message: `${teacher.teacher_code} - ${teacher.full_name}, your final choices for ${term.name} have been submitted for coordinator/admin review.`,
    });

    return NextResponse.json({
      success: true,
      message: "Final choice submission completed successfully.",
      totalCredits,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to finalize faculty choices." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { canFacultyEdit } from "@/lib/faculty-access";
import { validateFacultySession } from "@/lib/faculty-session";
import { getFacultyLevelCreditPolicy } from "@/lib/system-settings";

type SlotLike = {
  day_of_week: string;
  start_time: string;
  end_time: string;
};

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function slotsOverlap(a: SlotLike, b: SlotLike) {
  if (a.day_of_week !== b.day_of_week) return false;

  const aStart = timeToMinutes(a.start_time);
  const aEnd = timeToMinutes(a.end_time);
  const bStart = timeToMinutes(b.start_time);
  const bEnd = timeToMinutes(b.end_time);

  return aStart < bEnd && bStart < aEnd;
}

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
    const offeredCourseIds = Array.isArray(body.offeredCourseIds)
      ? body.offeredCourseIds
          .map((x: unknown) => Number(x))
          .filter((x: number) => Number.isInteger(x) && x > 0)
      : [];

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

    const hasFinal = await prisma.faculty_course_selections.findFirst({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
        status: "FINAL",
      },
      select: { id: true },
    });

    if (hasFinal) {
      return NextResponse.json(
        {
          error:
            "Your choices are already finally submitted. Coordinator/admin must reopen them before editing.",
        },
        { status: 400 }
      );
    }

    const validCourses = offeredCourseIds.length
      ? await prisma.offered_courses.findMany({
          where: {
            id: { in: offeredCourseIds },
            primary_offered_course_id: null,
            offerings: {
              academic_term_id: term.id,
              status: {
                in: ["FACULTY_CHOICE_BUFFER", "FACULTY_CHOICE_FINALIZED"],
              },
            },
          },
          include: {
            offered_course_slots: {
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
            },
            faculty_course_selections: {
              include: {
                teachers: true,
              },
            },
            master_courses: {
              select: {
                credit: true,
                course_code: true,
                course_title: true,
              },
            },
          },
        })
      : [];

    if (validCourses.length !== offeredCourseIds.length) {
      return NextResponse.json(
        {
          error:
            "One or more selected courses are invalid or not open for faculty choice in this term.",
        },
        { status: 400 }
      );
    }

    const takenFinalByOther = validCourses.find((course) =>
      course.faculty_course_selections.some(
        (x) => x.status === "FINAL" && x.teacher_id !== teacher.id
      )
    );

    if (takenFinalByOther) {
      return NextResponse.json(
        {
          error:
            "One or more selected sections have already been finalized by another faculty and are no longer available.",
        },
        { status: 400 }
      );
    }

    for (let i = 0; i < validCourses.length; i += 1) {
      for (let j = i + 1; j < validCourses.length; j += 1) {
        const a = validCourses[i];
        const b = validCourses[j];

        const overlaps =
          a.offered_course_slots.length > 0 &&
          b.offered_course_slots.length > 0 &&
          a.offered_course_slots.some((slotA) =>
            b.offered_course_slots.some((slotB) => slotsOverlap(slotA, slotB))
          );

        if (overlaps) {
          return NextResponse.json(
            {
              error: `Time conflict detected between ${a.master_courses.course_code} Sec-${a.section} and ${b.master_courses.course_code} Sec-${b.section}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const totalCredits = validCourses.reduce(
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
          error: `Selected credits ${totalCredits} exceed your allowed maximum ${creditPolicy.maxCredits}.`,
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
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save faculty choice buffer." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { canFacultyEdit } from "@/lib/faculty-access";
import { getFacultyLevelCreditPolicy } from "@/lib/system-settings";

const FACULTY_EDITABLE_OFFERING_STATUS = "FACULTY_CHOICE_BUFFER";

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((x) => Number.isFinite(x))));
}

function overlaps(
  a: { day_of_week: string; start_time: string; end_time: string },
  b: { day_of_week: string; start_time: string; end_time: string }
) {
  if (a.day_of_week.toUpperCase() !== b.day_of_week.toUpperCase()) return false;
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

function finalizedMarkerKey(termId: number, teacherId: number) {
  return `FACULTY_FINALIZED_TERM_${termId}_TEACHER_${teacherId}`;
}

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

    const body = await req.json();
    const termName = String(body.termName || "").trim().toUpperCase();
    const offeredCourseIds = Array.isArray(body.offeredCourseIds)
      ? uniqueNumbers(body.offeredCourseIds.map((x: unknown) => Number(x)))
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

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Faculty session token is missing." },
        { status: 401 }
      );
    }

    const access = await canFacultyEdit(sessionToken, {
      id: teacher.id,
      seniority_level: teacher.seniority_level,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.message || "Editing not allowed." },
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

    const finalMarker = await prisma.systemSetting.findUnique({
      where: {
        settingKey: finalizedMarkerKey(term.id, teacher.id),
      },
      select: {
        settingValue: true,
      },
    });

    if (finalMarker?.settingValue === "true") {
      return NextResponse.json(
        {
          error:
            "Final submission already completed. Reopen is required before editing.",
        },
        { status: 400 }
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
        {
          error:
            "Final submission already completed. Reopen is required before editing.",
        },
        { status: 400 }
      );
    }

    const chosenCourses = await prisma.offered_courses.findMany({
      where: {
        id: {
          in: offeredCourseIds,
        },
      },
      include: {
        offerings: true,
        master_courses: {
          select: {
            credit: true,
          },
        },
        offered_course_teachers: {
          select: {
            teacher_id: true,
          },
        },
        offered_course_slots: {
          select: {
            day_of_week: true,
            start_time: true,
            end_time: true,
          },
        },
        faculty_course_selections: {
          where: {
            academic_term_id: term.id,
          },
          select: {
            teacher_id: true,
            status: true,
          },
        },
      },
    });

    if (chosenCourses.length !== offeredCourseIds.length) {
      return NextResponse.json(
        { error: "One or more selected offered sections could not be found." },
        { status: 400 }
      );
    }

    const invalidStatusRows = chosenCourses.filter(
      (course) => course.offerings.status !== FACULTY_EDITABLE_OFFERING_STATUS
    );

    if (invalidStatusRows.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more selected sections are not currently in active faculty choice stage.",
        },
        { status: 400 }
      );
    }

    const forbiddenPreassignedRows = chosenCourses.filter((course) => {
      const assignedTeacherIds = course.offered_course_teachers.map(
        (x) => x.teacher_id
      );
      if (!assignedTeacherIds.length) return false;
      return !assignedTeacherIds.includes(teacher.id);
    });

    if (forbiddenPreassignedRows.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more selected sections are already preassigned to another faculty and cannot be chosen by you.",
        },
        { status: 403 }
      );
    }

    const forbiddenOwnPreassignedRows = chosenCourses.filter((course) => {
      const assignedTeacherIds = course.offered_course_teachers.map(
        (x) => x.teacher_id
      );
      return assignedTeacherIds.includes(teacher.id);
    });

    if (forbiddenOwnPreassignedRows.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more selected sections are already preassigned to you and must not be selected again.",
        },
        { status: 400 }
      );
    }

    const finalByOthers = chosenCourses.filter((course) =>
      course.faculty_course_selections.some(
        (x) => x.teacher_id !== teacher.id && x.status === "FINAL"
      )
    );

    if (finalByOthers.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more selected sections are already finalized by another faculty.",
        },
        { status: 403 }
      );
    }

    const preassignedAssignments =
      await prisma.offered_course_teachers.findMany({
        where: {
          teacher_id: teacher.id,
          offered_courses: {
            offerings: {
              academic_term_id: term.id,
            },
          },
        },
        include: {
          offered_courses: {
            include: {
              master_courses: {
                select: {
                  credit: true,
                },
              },
              offered_course_slots: {
                select: {
                  day_of_week: true,
                  start_time: true,
                  end_time: true,
                },
              },
            },
          },
        },
      });

    const preassignedCourseIds = new Set(
      preassignedAssignments.map((x) => x.offered_course_id)
    );

    const preassignedCredits = Array.from(
      new Map(
        preassignedAssignments.map((x) => [
          x.offered_course_id,
          Number(x.offered_courses.master_courses.credit || 0),
        ])
      ).values()
    ).reduce((sum, credit) => sum + credit, 0);

    const selectedCredits = Array.from(
      new Map(
        chosenCourses.map((x) => [x.id, Number(x.master_courses.credit || 0)])
      ).values()
    ).reduce((sum, credit) => sum + credit, 0);

    const totalSelectedCredits = Number(
      (preassignedCredits + selectedCredits).toFixed(2)
    );

    const creditPolicy = await getFacultyLevelCreditPolicy(
      teacher.seniority_level
    );

    if (
      creditPolicy?.maxCredits !== null &&
      creditPolicy?.maxCredits !== undefined &&
      totalSelectedCredits > creditPolicy.maxCredits
    ) {
      return NextResponse.json(
        {
          error: `Total load ${totalSelectedCredits} exceeds the maximum allowed ${creditPolicy.maxCredits}. Your preassigned credits are already included in this calculation.`,
        },
        { status: 400 }
      );
    }

    const occupiedSlots = preassignedAssignments.flatMap(
      (assignment) => assignment.offered_courses.offered_course_slots
    );

    for (const course of chosenCourses) {
      if (preassignedCourseIds.has(course.id)) continue;

      for (const slot of course.offered_course_slots) {
        const conflict = occupiedSlots.some((occupied) =>
          overlaps(slot, occupied)
        );

        if (conflict) {
          return NextResponse.json(
            {
              error:
                "One or more selected sections conflict with your existing preassigned schedule.",
            },
            { status: 400 }
          );
        }
      }

      occupiedSlots.push(...course.offered_course_slots);
    }

    await prisma.$transaction(async (tx) => {
      await tx.faculty_course_selections.deleteMany({
        where: {
          teacher_id: teacher.id,
          academic_term_id: term.id,
          status: "BUFFER",
        },
      });

      let priorityCounter = 1;

      for (const offeredCourseId of offeredCourseIds) {
        await tx.faculty_course_selections.create({
          data: {
            teacher_id: teacher.id,
            academic_term_id: term.id,
            offered_course_id: offeredCourseId,
            status: "BUFFER",
            priority_order: priorityCounter,
            confirmed_at: null,
          },
        });

        priorityCounter += 1;
      }
    });

    return NextResponse.json({
      success: true,
      message: "Choice buffer saved successfully.",
      preassignedCredits,
      selectedCredits,
      totalCredits: totalSelectedCredits,
      creditPolicy,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save faculty choice buffer.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { canFacultyEdit } from "@/lib/faculty-access";
import { getFacultyLevelCreditPolicy } from "@/lib/system-settings";
import {
  revokeFacultySession,
  sendFacultyTurnNotification,
} from "@/lib/faculty-session";
import { getCurrentActiveFacultyTurn } from "@/lib/faculty-turn";

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

    const currentBufferSelections =
      await prisma.faculty_course_selections.findMany({
        where: {
          teacher_id: teacher.id,
          academic_term_id: term.id,
          status: "BUFFER",
        },
        include: {
          offered_courses: {
            include: {
              master_courses: {
                select: {
                  credit: true,
                },
              },
            },
          },
        },
      });

    const existingFinalSelections =
      await prisma.faculty_course_selections.findMany({
        where: {
          teacher_id: teacher.id,
          academic_term_id: term.id,
          status: "FINAL",
        },
        select: {
          id: true,
        },
      });

    if (existingFinalSelections.length > 0) {
      return NextResponse.json(
        {
          error:
            "Final submission already completed. Reopen is required before editing.",
        },
        { status: 400 }
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
            },
          },
        },
      });

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
        currentBufferSelections.map((x) => [
          x.offered_course_id,
          Number(x.offered_courses.master_courses.credit || 0),
        ])
      ).values()
    ).reduce((sum, credit) => sum + credit, 0);

    const totalCredits = Number((preassignedCredits + selectedCredits).toFixed(2));

    const creditPolicy = await getFacultyLevelCreditPolicy(
      teacher.seniority_level
    );

    if (
      creditPolicy?.minCredits !== null &&
      creditPolicy?.minCredits !== undefined &&
      totalCredits < creditPolicy.minCredits
    ) {
      return NextResponse.json(
        {
          error: `Total load ${totalCredits} is below the minimum required ${creditPolicy.minCredits}. Preassigned load is already included in this calculation.`,
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
          error: `Total load ${totalCredits} exceeds the maximum allowed ${creditPolicy.maxCredits}.`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.faculty_course_selections.updateMany({
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

      await tx.systemSetting.upsert({
        where: {
          settingKey: finalizedMarkerKey(term.id, teacher.id),
        },
        update: {
          settingValue: "true",
        },
        create: {
          settingKey: finalizedMarkerKey(term.id, teacher.id),
          settingValue: "true",
        },
      });
    });

    await revokeFacultySession(sessionToken);

    const nextTurn = await getCurrentActiveFacultyTurn();

    if (nextTurn?.teacherId && nextTurn.teacherId !== teacher.id) {
      await sendFacultyTurnNotification(nextTurn.teacherId);
    }

    return NextResponse.json({
      success: true,
      message:
        currentBufferSelections.length > 0
          ? "Final choice submission completed successfully. Your turn has been closed and the next faculty may proceed."
          : "Final submission completed with preassigned load only. Your turn has been closed and the next faculty may proceed.",
      preassignedCredits,
      selectedCredits,
      totalCredits,
      creditPolicy,
      finalizedWithoutChoiceRows: currentBufferSelections.length === 0,
      nextTurn: nextTurn
        ? {
            teacherId: nextTurn.teacherId,
            teacherCode: nextTurn.teacherCode,
            fullName: nextTurn.fullName,
            seniorityLevel: nextTurn.seniorityLevel,
          }
        : null,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize faculty choices.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { createFacultyNotification } from "@/lib/faculty-notifications";

function finalizedMarkerKey(termId: number, teacherId: number) {
  return `FACULTY_FINALIZED_TERM_${termId}_TEACHER_${teacherId}`;
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const teacherId = Number(body.teacherId);
    const termName = String(body.termName || "").trim().toUpperCase();

    if (!teacherId || !termName) {
      return NextResponse.json(
        { error: "teacherId and termName are required." },
        { status: 400 }
      );
    }

    const [teacher, term] = await Promise.all([
      prisma.teachers.findUnique({
        where: { id: teacherId },
        select: {
          id: true,
          teacher_code: true,
          full_name: true,
        },
      }),
      prisma.academic_terms.findFirst({
        where: { name: termName },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!teacher) {
      return NextResponse.json(
        { error: "Faculty member not found." },
        { status: 404 }
      );
    }

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      /*
        Reopen means:
        1. Remove approved-choice official assignments only.
        2. Keep IMPORTED/manual/preassigned rows untouched.
        3. Convert FINAL choice rows back to BUFFER.
        4. Remove finalized marker so faculty can save/finalize again.
      */

      const removedApprovedChoiceAssignments =
        await tx.offered_course_teachers.deleteMany({
          where: {
            teacher_id: teacher.id,
            load_type: "APPROVED_CHOICE",
            offered_courses: {
              offerings: {
                academic_term_id: term.id,
              },
            },
          },
        });

      const reopenedChoices = await tx.faculty_course_selections.updateMany({
        where: {
          teacher_id: teacher.id,
          academic_term_id: term.id,
          status: "FINAL",
        },
        data: {
          status: "BUFFER",
          confirmed_at: null,
        },
      });

      const removedFinalMarker = await tx.systemSetting.deleteMany({
        where: {
          settingKey: finalizedMarkerKey(term.id, teacher.id),
        },
      });

      await tx.faculty_login_sessions.updateMany({
        where: {
          teacher_id: teacher.id,
          revoked_at: null,
        },
        data: {
          revoked_at: new Date(),
        },
      });

      return {
        removedApprovedChoiceAssignments:
          removedApprovedChoiceAssignments.count,
        reopenedChoices: reopenedChoices.count,
        removedFinalMarker: removedFinalMarker.count,
      };
    });

    const linkedUsers = await prisma.users.findMany({
      where: {
        teacher_id: teacher.id,
        is_active: true,
        role: "FACULTY",
      },
      select: {
        id: true,
      },
    });

    for (const user of linkedUsers) {
      await createFacultyNotification({
        recipientUserId: user.id,
        recipientTeacherId: teacher.id,
        createdByUserId: guard.id,
        eventType: "FACULTY_CHOICE_REOPENED",
        title: "Faculty choices reopened",
        message: `Your final choices for ${term.name} were reopened by coordinator/admin. Please log in again, review your buffer, and resubmit if required.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Reopened choices for ${teacher.teacher_code} - ${teacher.full_name}. Removed ${result.removedApprovedChoiceAssignments} approved-choice assignment row(s), reopened ${result.reopenedChoices} final choice row(s), and cleared final lock marker. Imported/preassigned assignments were kept unchanged.`,
      ...result,
    });
  } catch (error) {
    console.error("Reopen faculty choices error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reopen faculty choices.",
      },
      { status: 500 }
    );
  }
}
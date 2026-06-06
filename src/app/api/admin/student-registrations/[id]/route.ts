import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getRegistrationHeader,
  normalizeRegistrationStatus,
  parsePositiveInteger,
  recalculateRegistrationCredits,
  writeStudentRegistrationAction,
} from "@/lib/student-registration";

type RegisteredCourseRow = {
  id: number;
  registration_id: number;
  offered_course_id: number;
  course_status: string;
  action_type: string;
  credit: number;
  is_retake: boolean;
  is_improvement: boolean;
  course_code: string;
  course_title: string;
  section: string;
  program_code: string;
  faculty_text: string | null;
  schedule_text: string | null;
  room_text: string | null;
  added_at: Date;
  dropped_at: Date | null;
};

type ActionRow = {
  id: number;
  registration_id: number;
  action_type: string;
  old_status: string | null;
  new_status: string | null;
  note: string | null;
  performed_by_student: boolean;
  created_at: Date;
};

function getTimestampColumnForStatus(status: string) {
  if (status === "SUBMITTED") return "submitted_at";
  if (status === "ADVISOR_APPROVED") return "advisor_approved_at";
  if (status === "COORDINATOR_APPROVED") return "coordinator_approved_at";
  if (status === "LOCKED") return "locked_at";
  if (status === "CANCELLED") return "cancelled_at";
  return null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const registrationId = parsePositiveInteger(id, "registration id");

    const header = await getRegistrationHeader(registrationId);

    if (!header) {
      return NextResponse.json(
        {
          ok: false,
          error: "Student registration not found.",
        },
        { status: 404 }
      );
    }

    await recalculateRegistrationCredits(registrationId);

    const updatedHeader = await getRegistrationHeader(registrationId);

    const courses = await prisma.$queryRaw<RegisteredCourseRow[]>`
      SELECT
        src.id,
        src.registration_id,
        src.offered_course_id,
        src.course_status,
        src.action_type,
        src.credit,
        src.is_retake,
        src.is_improvement,
        mc.course_code,
        mc.course_title,
        oc.section,
        p.short_name AS program_code,
        COALESCE(
          STRING_AGG(DISTINCT t.teacher_code, ', ' ORDER BY t.teacher_code),
          ''
        ) AS faculty_text,
        COALESCE(
          STRING_AGG(
            DISTINCT CONCAT(ocs.day_of_week, ' ', ocs.start_time, '-', ocs.end_time),
            ', '
          ),
          ''
        ) AS schedule_text,
        COALESCE(
          STRING_AGG(DISTINCT r.room_code, ', ' ORDER BY r.room_code),
          ''
        ) AS room_text,
        src.added_at,
        src.dropped_at
      FROM student_registered_courses src
      JOIN offered_courses oc ON oc.id = src.offered_course_id
      JOIN master_courses mc ON mc.id = oc.master_course_id
      JOIN programs p ON p.id = mc.program_id
      LEFT JOIN offered_course_teachers oct ON oct.offered_course_id = oc.id
      LEFT JOIN teachers t ON t.id = oct.teacher_id
      LEFT JOIN offered_course_slots ocs ON ocs.offered_course_id = oc.id
      LEFT JOIN rooms r ON r.id = ocs.room_id
      WHERE src.registration_id = ${registrationId}
      GROUP BY
        src.id,
        src.registration_id,
        src.offered_course_id,
        src.course_status,
        src.action_type,
        src.credit,
        src.is_retake,
        src.is_improvement,
        mc.course_code,
        mc.course_title,
        oc.section,
        p.short_name,
        src.added_at,
        src.dropped_at
      ORDER BY src.id ASC;
    `;

    const actions = await prisma.$queryRaw<ActionRow[]>`
      SELECT
        id,
        registration_id,
        action_type,
        old_status,
        new_status,
        note,
        performed_by_student,
        created_at
      FROM student_registration_actions
      WHERE registration_id = ${registrationId}
      ORDER BY created_at DESC, id DESC;
    `;

    return NextResponse.json({
      ok: true,
      registration: updatedHeader,
      courses: courses.map((course) => ({
        id: course.id,
        registrationId: course.registration_id,
        offeredCourseId: course.offered_course_id,
        courseStatus: course.course_status,
        actionType: course.action_type,
        credit: Number(course.credit || 0),
        isRetake: Boolean(course.is_retake),
        isImprovement: Boolean(course.is_improvement),
        courseCode: course.course_code,
        courseTitle: course.course_title,
        section: course.section,
        programCode: course.program_code,
        facultyText: course.faculty_text || "-",
        scheduleText: course.schedule_text || "-",
        roomText: course.room_text || "-",
        addedAt: course.added_at,
        droppedAt: course.dropped_at,
      })),
      actions: actions.map((action) => ({
        id: action.id,
        registrationId: action.registration_id,
        actionType: action.action_type,
        oldStatus: action.old_status,
        newStatus: action.new_status,
        note: action.note,
        performedByStudent: action.performed_by_student,
        createdAt: action.created_at,
      })),
    });
  } catch (error) {
    console.error("Student registration detail error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load student registration detail.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const registrationId = parsePositiveInteger(id, "registration id");

    const body = await req.json();
    const nextStatus = normalizeRegistrationStatus(body.status);
    const note = String(body.note || "").trim() || null;

    const existing = await getRegistrationHeader(registrationId);

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Student registration not found.",
        },
        { status: 404 }
      );
    }

    if (existing.status === nextStatus) {
      return NextResponse.json({
        ok: true,
        message: "Registration already has this status.",
        registration: existing,
      });
    }

    const timestampColumn = getTimestampColumnForStatus(nextStatus);

    if (timestampColumn) {
      await prisma.$executeRawUnsafe(
        `
        UPDATE student_semester_registrations
        SET status = $1,
            ${timestampColumn} = NOW(),
            updated_at = NOW()
        WHERE id = $2;
        `,
        nextStatus,
        registrationId
      );
    } else {
      await prisma.$executeRaw`
        UPDATE student_semester_registrations
        SET status = ${nextStatus},
            updated_at = NOW()
        WHERE id = ${registrationId};
      `;
    }

    await writeStudentRegistrationAction({
      registrationId,
      studentIdRef: existing.student_id_ref,
      actionType: "STATUS_CHANGED",
      oldStatus: existing.status,
      newStatus: nextStatus,
      performedByStudent: false,
      note,
    });

    const updated = await getRegistrationHeader(registrationId);

    return NextResponse.json({
      ok: true,
      message: "Student registration status updated.",
      registration: updated,
    });
  } catch (error) {
    console.error("Student registration status update error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update student registration status.",
      },
      { status: 500 }
    );
  }
}
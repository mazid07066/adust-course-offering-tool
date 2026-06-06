import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession, isStudentPortalEnabled } from "@/lib/student-session";

const ELIGIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

type EligibleCourseRow = {
  offered_course_id: number;
  offering_id: number;
  offering_status: string;
  academic_term_id: number;
  academic_term_name: string;
  program_id: number;
  program_code: string;
  program_name: string;
  course_code: string;
  course_title: string;
  credit: number;
  section: string;
  batch_id: number | null;
  batch_code: string | null;
  role: string;
  primary_offered_course_id: number | null;
  primary_course_code: string | null;
  primary_section: string | null;
  faculty_text: string | null;
  schedule_text: string | null;
  room_text: string | null;
  selected_count: number;
};

type ExistingRegistrationRow = {
  registration_id: number;
  registration_status: string;
  total_credits: number;
};

function parsePositiveInteger(value: unknown, label: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

export async function GET(req: NextRequest) {
  try {
    const portal = await isStudentPortalEnabled();

    if (!portal.enabled) {
      return NextResponse.json(
        {
          ok: false,
          error: portal.message,
        },
        { status: 403 }
      );
    }

    const session = await getStudentSession();

    if (!session?.studentDbId || !session?.studentId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized student session.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const academicTermIdRaw = searchParams.get("academicTermId");

    if (!academicTermIdRaw) {
      return NextResponse.json(
        {
          ok: false,
          error: "academicTermId is required.",
        },
        { status: 400 }
      );
    }

    const academicTermId = parsePositiveInteger(
      academicTermIdRaw,
      "academicTermId"
    );

    const activeEnrollments = await prisma.$queryRaw<
      Array<{
        id: number;
        student_id_ref: number;
        program_id: number;
        batch_id: number | null;
        enrollment_status: string;
      }>
    >`
      SELECT
        id,
        student_id_ref,
        program_id,
        batch_id,
        enrollment_status
      FROM student_program_enrollments
      WHERE student_id_ref = ${session.studentDbId}
        AND enrollment_status = 'ACTIVE'
      ORDER BY id DESC
      LIMIT 1;
    `;

    const activeEnrollment = activeEnrollments[0];

    if (!activeEnrollment) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No active program enrollment found for this student. Please contact admin.",
        },
        { status: 400 }
      );
    }

    if (!activeEnrollment.batch_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No active batch is linked with this student enrollment. Please contact admin.",
        },
        { status: 400 }
      );
    }

    const termRows = await prisma.$queryRaw<
      Array<{ id: number; name: string }>
    >`
      SELECT id, name
      FROM academic_terms
      WHERE id = ${academicTermId}
      LIMIT 1;
    `;

    const term = termRows[0];

    if (!term) {
      return NextResponse.json(
        {
          ok: false,
          error: "Academic term not found.",
        },
        { status: 404 }
      );
    }

    const registrationRows = await prisma.$queryRaw<ExistingRegistrationRow[]>`
      SELECT
        id AS registration_id,
        status AS registration_status,
        total_credits
      FROM student_semester_registrations
      WHERE student_id_ref = ${session.studentDbId}
        AND academic_term_id = ${academicTermId}
        AND program_id = ${activeEnrollment.program_id}
      LIMIT 1;
    `;

    const registration = registrationRows[0] || null;

    const courses = await prisma.$queryRaw<EligibleCourseRow[]>`
      SELECT
        oc.id AS offered_course_id,
        o.id AS offering_id,
        o.status AS offering_status,
        o.academic_term_id,
        at.name AS academic_term_name,
        p.id AS program_id,
        p.short_name AS program_code,
        p.name AS program_name,
        mc.course_code,
        mc.course_title,
        mc.credit,
        oc.section,
        b.id AS batch_id,
        b.batch_code,
        CASE
          WHEN oc.primary_offered_course_id IS NULL THEN 'PRIMARY'
          ELSE 'SECONDARY'
        END AS role,
        oc.primary_offered_course_id,
        pmc.course_code AS primary_course_code,
        poc.section AS primary_section,
        COALESCE(
          STRING_AGG(DISTINCT t.teacher_code, ', ' ORDER BY t.teacher_code),
          ''
        ) AS faculty_text,
        COALESCE(
          STRING_AGG(
            DISTINCT CONCAT(
              COALESCE(effective_slots.day_of_week, ''),
              ' ',
              COALESCE(effective_slots.start_time, ''),
              '-',
              COALESCE(effective_slots.end_time, '')
            ),
            ', '
          ),
          ''
        ) AS schedule_text,
        COALESCE(
          STRING_AGG(DISTINCT r.room_code, ', ' ORDER BY r.room_code),
          ''
        ) AS room_text,
        COALESCE(selected_counts.selected_count, 0)::int AS selected_count
      FROM offered_courses oc
      JOIN offerings o ON o.id = oc.offering_id
      JOIN academic_terms at ON at.id = o.academic_term_id
      JOIN master_courses mc ON mc.id = oc.master_course_id
      JOIN programs p ON p.id = mc.program_id
      JOIN offered_course_batches ocb ON ocb.offered_course_id = oc.id
      JOIN batches b ON b.id = ocb.batch_id

      LEFT JOIN offered_courses poc ON poc.id = oc.primary_offered_course_id
      LEFT JOIN master_courses pmc ON pmc.id = poc.master_course_id

      LEFT JOIN offered_course_slots effective_slots
        ON effective_slots.offered_course_id =
          CASE
            WHEN oc.primary_offered_course_id IS NULL THEN oc.id
            ELSE oc.primary_offered_course_id
          END

      LEFT JOIN rooms r ON r.id = effective_slots.room_id

      LEFT JOIN offered_course_teachers effective_teachers
        ON effective_teachers.offered_course_id =
          CASE
            WHEN oc.primary_offered_course_id IS NULL THEN oc.id
            ELSE oc.primary_offered_course_id
          END

      LEFT JOIN teachers t ON t.id = effective_teachers.teacher_id

      LEFT JOIN (
        SELECT
          src.offered_course_id,
          COUNT(src.id)::int AS selected_count
        FROM student_registered_courses src
        JOIN student_semester_registrations ssr
          ON ssr.id = src.registration_id
        WHERE ssr.academic_term_id = ${academicTermId}
          AND src.course_status = 'ADDED'
          AND ssr.status IN (
            'DRAFT',
            'SUBMITTED',
            'ADVISOR_APPROVED',
            'COORDINATOR_APPROVED',
            'LOCKED'
          )
        GROUP BY src.offered_course_id
      ) selected_counts
        ON selected_counts.offered_course_id = oc.id

      WHERE o.academic_term_id = ${academicTermId}
        AND o.status IN (
          'FACULTY_CHOICE_BUFFER',
          'FACULTY_CHOICE_FINALIZED',
          'CONFIRMED'
        )
        AND o.program_id = ${activeEnrollment.program_id}
        AND ocb.batch_id = ${activeEnrollment.batch_id}

      GROUP BY
        oc.id,
        o.id,
        o.status,
        o.academic_term_id,
        at.name,
        p.id,
        p.short_name,
        p.name,
        mc.course_code,
        mc.course_title,
        mc.credit,
        oc.section,
        b.id,
        b.batch_code,
        oc.primary_offered_course_id,
        pmc.course_code,
        poc.section,
        selected_counts.selected_count

      ORDER BY
        mc.course_code ASC,
        oc.section ASC,
        oc.id ASC;
    `;

    return NextResponse.json({
      ok: true,
      student: {
        id: session.studentDbId,
        studentId: session.studentId,
        fullName: session.fullName,
      },
      enrollment: {
        id: activeEnrollment.id,
        programId: activeEnrollment.program_id,
        batchId: activeEnrollment.batch_id,
      },
      academicTerm: {
        id: term.id,
        name: term.name,
      },
      registration: registration
        ? {
            id: registration.registration_id,
            status: registration.registration_status,
            totalCredits: Number(registration.total_credits || 0),
          }
        : null,
      eligibleStatuses: ELIGIBLE_OFFERING_STATUSES,
      courses: courses.map((course) => ({
        offeredCourseId: course.offered_course_id,
        offeringId: course.offering_id,
        offeringStatus: course.offering_status,
        academicTermId: course.academic_term_id,
        academicTermName: course.academic_term_name,
        programId: course.program_id,
        programCode: course.program_code,
        programName: course.program_name,
        courseCode: course.course_code,
        courseTitle: course.course_title,
        credit: Number(course.credit || 0),
        section: course.section,
        batchId: course.batch_id,
        batchCode: course.batch_code,
        role: course.role,
        primaryOfferedCourseId: course.primary_offered_course_id,
        primaryReference: course.primary_offered_course_id
          ? `${course.primary_course_code || "-"} Sec-${
              course.primary_section || "-"
            }`
          : null,
        facultyText: course.faculty_text || "-",
        scheduleText:
          course.schedule_text && course.schedule_text.trim() !== "-"
            ? course.schedule_text
            : "-",
        roomText: course.room_text || "-",
        selectedCount: Number(course.selected_count || 0),
      })),
    });
  } catch (error) {
    console.error("Student eligible courses error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load eligible offered courses.",
      },
      { status: 500 }
    );
  }
}
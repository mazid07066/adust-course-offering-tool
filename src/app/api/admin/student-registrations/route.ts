import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  buildRegistrationWhereClause,
  normalizeRegistrationStatus,
  normalizeStudentId,
  parsePositiveInteger,
  writeStudentRegistrationAction,
} from "@/lib/student-registration";

type RegistrationListRow = {
  id: number;
  student_id_ref: number;
  student_id: string;
  full_name: string;
  academic_term_id: number;
  academic_term_name: string;
  program_id: number;
  program_code: string;
  program_name: string;
  batch_id: number | null;
  batch_code: string | null;
  status: string;
  total_credits: number;
  selected_course_count: number;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const academicTermIdRaw = searchParams.get("academicTermId");
    const programIdRaw = searchParams.get("programId");
    const batchIdRaw = searchParams.get("batchId");
    const statusRaw = searchParams.get("status");
    const search = String(searchParams.get("search") || "").trim();

    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const pageSize = Math.min(
      Math.max(Number(searchParams.get("pageSize") || 25), 1),
      100
    );
    const offset = (page - 1) * pageSize;

    const academicTermId = academicTermIdRaw
      ? parsePositiveInteger(academicTermIdRaw, "academicTermId")
      : null;

    const programId = programIdRaw
      ? parsePositiveInteger(programIdRaw, "programId")
      : null;

    const batchId = batchIdRaw
      ? parsePositiveInteger(batchIdRaw, "batchId")
      : null;

    const status = statusRaw ? normalizeRegistrationStatus(statusRaw) : null;

    const whereClause = buildRegistrationWhereClause({
      academicTermId,
      programId,
      batchId,
      status,
      search: search || null,
    });

    const rows = await prisma.$queryRaw<RegistrationListRow[]>(
      Prisma.sql`
        SELECT
          ssr.id,
          ssr.student_id_ref,
          s.student_id,
          s.full_name,
          ssr.academic_term_id,
          at.name AS academic_term_name,
          ssr.program_id,
          p.short_name AS program_code,
          p.name AS program_name,
          ssr.batch_id,
          b.batch_code,
          ssr.status,
          ssr.total_credits,
          COUNT(src.id)::int AS selected_course_count,
          ssr.submitted_at,
          ssr.created_at,
          ssr.updated_at
        FROM student_semester_registrations ssr
        JOIN students s ON s.id = ssr.student_id_ref
        JOIN academic_terms at ON at.id = ssr.academic_term_id
        JOIN programs p ON p.id = ssr.program_id
        LEFT JOIN batches b ON b.id = ssr.batch_id
        LEFT JOIN student_registered_courses src
          ON src.registration_id = ssr.id
         AND src.course_status = 'ADDED'
        ${whereClause}
        GROUP BY
          ssr.id,
          ssr.student_id_ref,
          s.student_id,
          s.full_name,
          ssr.academic_term_id,
          at.name,
          ssr.program_id,
          p.short_name,
          p.name,
          ssr.batch_id,
          b.batch_code,
          ssr.status,
          ssr.total_credits,
          ssr.submitted_at,
          ssr.created_at,
          ssr.updated_at
        ORDER BY ssr.updated_at DESC, ssr.id DESC
        LIMIT ${pageSize}
        OFFSET ${offset};
      `
    );

    const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM student_semester_registrations ssr
        JOIN students s ON s.id = ssr.student_id_ref
        JOIN academic_terms at ON at.id = ssr.academic_term_id
        JOIN programs p ON p.id = ssr.program_id
        LEFT JOIN batches b ON b.id = ssr.batch_id
        ${whereClause};
      `
    );

    const total = Number(countRows[0]?.total || 0);

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      registrations: rows.map((row) => ({
        id: row.id,
        studentIdRef: row.student_id_ref,
        studentId: row.student_id,
        fullName: row.full_name,
        academicTermId: row.academic_term_id,
        academicTermName: row.academic_term_name,
        programId: row.program_id,
        programCode: row.program_code,
        programName: row.program_name,
        batchId: row.batch_id,
        batchCode: row.batch_code,
        status: row.status,
        totalCredits: Number(row.total_credits || 0),
        selectedCourseCount: Number(row.selected_course_count || 0),
        submittedAt: row.submitted_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error("Student registrations list error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load student registrations.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const academicTermId = parsePositiveInteger(
      body.academicTermId,
      "academicTermId"
    );

    const studentIdInput = normalizeStudentId(body.studentId);
    const studentIdRefInput = body.studentIdRef
      ? parsePositiveInteger(body.studentIdRef, "studentIdRef")
      : null;

    if (!studentIdInput && !studentIdRefInput) {
      return NextResponse.json(
        {
          ok: false,
          error: "studentId or studentIdRef is required.",
        },
        { status: 400 }
      );
    }

    const students = studentIdRefInput
      ? await prisma.$queryRaw<
          Array<{ id: number; student_id: string; full_name: string }>
        >`
          SELECT id, student_id, full_name
          FROM students
          WHERE id = ${studentIdRefInput}
          LIMIT 1;
        `
      : await prisma.$queryRaw<
          Array<{ id: number; student_id: string; full_name: string }>
        >`
          SELECT id, student_id, full_name
          FROM students
          WHERE student_id = ${studentIdInput}
          LIMIT 1;
        `;

    const student = students[0];

    if (!student) {
      return NextResponse.json(
        {
          ok: false,
          error: "Student not found.",
        },
        { status: 404 }
      );
    }

    const enrollments = await prisma.$queryRaw<
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
      WHERE student_id_ref = ${student.id}
        AND enrollment_status = 'ACTIVE'
      ORDER BY id DESC
      LIMIT 1;
    `;

    const enrollment = enrollments[0];

    if (!enrollment) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No active student enrollment found. Please fix student enrollment before creating registration.",
        },
        { status: 400 }
      );
    }

    const termRows = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
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

    const createdRows = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO student_semester_registrations (
        student_id_ref,
        enrollment_id,
        academic_term_id,
        program_id,
        batch_id,
        status,
        total_credits,
        created_by_student,
        created_at,
        updated_at
      )
      VALUES (
        ${student.id},
        ${enrollment.id},
        ${academicTermId},
        ${enrollment.program_id},
        ${enrollment.batch_id},
        'DRAFT',
        0,
        FALSE,
        NOW(),
        NOW()
      )
      ON CONFLICT (student_id_ref, academic_term_id, program_id)
      DO UPDATE SET
        enrollment_id = EXCLUDED.enrollment_id,
        batch_id = EXCLUDED.batch_id,
        updated_at = NOW()
      RETURNING id;
    `;

    const registrationId = createdRows[0]?.id;

    if (!registrationId) {
      throw new Error("Failed to create or load registration draft.");
    }

    await writeStudentRegistrationAction({
      registrationId,
      studentIdRef: student.id,
      actionType: "CREATED",
      newStatus: "DRAFT",
      performedByStudent: false,
      note: `Registration draft created or loaded by admin/coordinator for ${term.name}.`,
    });

    return NextResponse.json({
      ok: true,
      message: "Student registration draft is ready.",
      registrationId,
    });
  } catch (error) {
    console.error("Student registration create error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create student registration draft.",
      },
      { status: 500 }
    );
  }
}
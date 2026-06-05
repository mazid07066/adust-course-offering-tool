import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/student-session";

type EnrollmentRow = {
  id: number;
  student_id: number;
  program_id: number | null;
  batch_id: number | null;
  admission_semester: string | null;
  status: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

export async function GET() {
  try {
    const session = await getStudentSession();

    if (!session?.accountId || !session?.studentId) {
      return NextResponse.json(
        { error: "Unauthorized student session." },
        { status: 401 }
      );
    }

    const accountRows = await prisma.$queryRaw<any[]>`
      SELECT
        spa.id,
        spa.student_id,
        spa.email,
        spa.is_active,
        spa.must_change_password,
        spa.last_login_at,
        spa.created_at,
        spa.updated_at
      FROM student_portal_accounts spa
      WHERE spa.id = ${session.accountId}
      LIMIT 1;
    `;

    const account = accountRows[0];

    if (!account || !account.is_active) {
      return NextResponse.json(
        { error: "Student account is not active." },
        { status: 403 }
      );
    }

    const studentRows = await prisma.$queryRaw<any[]>`
      SELECT
        s.id,
        s.student_id,
        s.full_name,
        s.email,
        s.phone,
        s.gender,
        s.date_of_birth,
        s.blood_group,
        s.present_address,
        s.permanent_address,
        s.guardian_name,
        s.guardian_phone,
        s.created_at,
        s.updated_at
      FROM students s
      WHERE s.id = ${session.studentId}
      LIMIT 1;
    `;

    const student = studentRows[0];

    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found." },
        { status: 404 }
      );
    }

    const enrollments = await prisma.$queryRaw<EnrollmentRow[]>`
      SELECT
        spe.id,
        spe.student_id,
        spe.program_id,
        spe.batch_id,
        spe.admission_semester,
        spe.status,
        spe.created_at,
        spe.updated_at
      FROM student_program_enrollments spe
      WHERE spe.student_id = ${session.studentId}
      ORDER BY spe.id DESC;
    `;

    const enrichedEnrollments = [];

    for (const enrollment of enrollments) {
      let program: any = null;
      let batch: any = null;

      if (enrollment.program_id) {
        const programRows = await prisma.$queryRaw<any[]>`
          SELECT id, name, short_name
          FROM program
          WHERE id = ${enrollment.program_id}
          LIMIT 1;
        `;
        program = programRows[0] || null;
      }

      if (enrollment.batch_id) {
        const batchRows = await prisma.$queryRaw<any[]>`
          SELECT id, batch_code
          FROM batches
          WHERE id = ${enrollment.batch_id}
          LIMIT 1;
        `;
        batch = batchRows[0] || null;
      }

      enrichedEnrollments.push({
        ...enrollment,
        program,
        batch,
      });
    }

    return NextResponse.json({
      success: true,
      account,
      student,
      enrollments: enrichedEnrollments,
    });
  } catch (error) {
    console.error("Student profile load error:", error);
    return NextResponse.json(
      { error: "Failed to load student profile." },
      { status: 500 }
    );
  }
}
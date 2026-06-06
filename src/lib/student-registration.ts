import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const STUDENT_REGISTRATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "ADVISOR_APPROVED",
  "COORDINATOR_APPROVED",
  "LOCKED",
  "CANCELLED",
] as const;

export type StudentRegistrationStatus =
  (typeof STUDENT_REGISTRATION_STATUSES)[number];

export const ACTIVE_STUDENT_REGISTRATION_STATUSES: StudentRegistrationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "ADVISOR_APPROVED",
  "COORDINATOR_APPROVED",
];

export const STUDENT_REGISTRATION_ACTION_TYPES = [
  "CREATED",
  "STATUS_CHANGED",
  "COURSE_ADDED",
  "COURSE_DROPPED",
  "SUBMITTED",
  "ADVISOR_APPROVED",
  "COORDINATOR_APPROVED",
  "LOCKED",
  "CANCELLED",
  "REJECTED",
] as const;

export function normalizeRegistrationStatus(value: unknown): StudentRegistrationStatus {
  const status = String(value || "").trim().toUpperCase();

  if (!STUDENT_REGISTRATION_STATUSES.includes(status as StudentRegistrationStatus)) {
    throw new Error(
      `Invalid registration status. Allowed: ${STUDENT_REGISTRATION_STATUSES.join(", ")}.`
    );
  }

  return status as StudentRegistrationStatus;
}

export function parsePositiveInteger(value: unknown, label: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

export function normalizeStudentId(value: unknown) {
  return String(value || "").trim();
}

export async function writeStudentRegistrationAction(input: {
  registrationId: number;
  studentIdRef?: number | null;
  offeredCourseId?: number | null;
  actionType: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  performedByUserId?: number | null;
  performedByStudent?: boolean;
  note?: string | null;
}) {
  await prisma.$executeRaw`
    INSERT INTO student_registration_actions (
      registration_id,
      student_id_ref,
      offered_course_id,
      action_type,
      old_status,
      new_status,
      performed_by_user_id,
      performed_by_student,
      note,
      created_at
    )
    VALUES (
      ${input.registrationId},
      ${input.studentIdRef ?? null},
      ${input.offeredCourseId ?? null},
      ${input.actionType},
      ${input.oldStatus ?? null},
      ${input.newStatus ?? null},
      ${input.performedByUserId ?? null},
      ${Boolean(input.performedByStudent)},
      ${input.note ?? null},
      NOW()
    );
  `;
}

export async function recalculateRegistrationCredits(registrationId: number) {
  const rows = await prisma.$queryRaw<Array<{ total_credits: number | null }>>`
    SELECT COALESCE(SUM(credit), 0)::float AS total_credits
    FROM student_registered_courses
    WHERE registration_id = ${registrationId}
      AND course_status = 'ADDED';
  `;

  const totalCredits = Number(rows[0]?.total_credits || 0);

  await prisma.$executeRaw`
    UPDATE student_semester_registrations
    SET total_credits = ${totalCredits},
        updated_at = NOW()
    WHERE id = ${registrationId};
  `;

  return totalCredits;
}

export async function getRegistrationHeader(registrationId: number) {
  const rows = await prisma.$queryRaw<
    Array<{
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
      submitted_at: Date | null;
      advisor_approved_at: Date | null;
      coordinator_approved_at: Date | null;
      locked_at: Date | null;
      cancelled_at: Date | null;
      remarks: string | null;
      created_at: Date;
      updated_at: Date;
    }>
  >`
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
      ssr.submitted_at,
      ssr.advisor_approved_at,
      ssr.coordinator_approved_at,
      ssr.locked_at,
      ssr.cancelled_at,
      ssr.remarks,
      ssr.created_at,
      ssr.updated_at
    FROM student_semester_registrations ssr
    JOIN students s ON s.id = ssr.student_id_ref
    JOIN academic_terms at ON at.id = ssr.academic_term_id
    JOIN programs p ON p.id = ssr.program_id
    LEFT JOIN batches b ON b.id = ssr.batch_id
    WHERE ssr.id = ${registrationId}
    LIMIT 1;
  `;

  return rows[0] || null;
}

export function buildRegistrationWhereClause(input: {
  academicTermId?: number | null;
  programId?: number | null;
  batchId?: number | null;
  status?: string | null;
  search?: string | null;
}) {
  const conditions: Prisma.Sql[] = [];

  if (input.academicTermId) {
    conditions.push(Prisma.sql`ssr.academic_term_id = ${input.academicTermId}`);
  }

  if (input.programId) {
    conditions.push(Prisma.sql`ssr.program_id = ${input.programId}`);
  }

  if (input.batchId) {
    conditions.push(Prisma.sql`ssr.batch_id = ${input.batchId}`);
  }

  if (input.status) {
    conditions.push(Prisma.sql`ssr.status = ${input.status}`);
  }

  if (input.search) {
    const q = `%${input.search.trim()}%`;
    conditions.push(
      Prisma.sql`(s.student_id ILIKE ${q} OR s.full_name ILIKE ${q})`
    );
  }

  if (conditions.length === 0) return Prisma.empty;

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}
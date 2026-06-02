import { prisma } from "@/lib/prisma";

type DbColumnRow = {
  column_name: string;
};

function sqlLiteral(value: unknown) {
  if (value === null || value === undefined || value === "") return "NULL";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }

  const text = String(value).replace(/'/g, "''");
  return `'${text}'`;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function pickColumn(columns: Set<string>, candidates: string[]) {
  for (const candidate of candidates) {
    if (columns.has(candidate)) return candidate;
  }

  return null;
}

async function getTableColumns(tableName: string) {
  const rows = await prisma.$queryRawUnsafe<DbColumnRow[]>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${sqlLiteral(tableName)}
    ORDER BY ordinal_position;
  `);

  return new Set(rows.map((row) => row.column_name));
}

export async function getStudentVerificationOptions() {
  const programColumns = await getTableColumns("programs");
  const batchColumns = await getTableColumns("batches");

  const programIdCol = pickColumn(programColumns, ["id"]) || "id";
  const programLabelCol =
    pickColumn(programColumns, [
      "display_label",
      "short_name",
      "program_code",
      "code",
      "name",
      "program_title",
    ]) || "name";

  const batchIdCol = pickColumn(batchColumns, ["id"]) || "id";
  const batchCodeCol =
    pickColumn(batchColumns, ["batch_code", "code"]) || "batch_code";
  const batchProgramIdCol =
    pickColumn(batchColumns, ["program_id"]) || "program_id";

  const programs = await prisma.$queryRawUnsafe<
    Array<{ id: number; label: string }>
  >(`
    SELECT
      ${quoteIdentifier(programIdCol)}::int AS id,
      ${quoteIdentifier(programLabelCol)}::text AS label
    FROM programs
    ORDER BY ${quoteIdentifier(programLabelCol)} ASC;
  `);

  const batches = await prisma.$queryRawUnsafe<
    Array<{ id: number; program_id: number; batch_code: string }>
  >(`
    SELECT
      ${quoteIdentifier(batchIdCol)}::int AS id,
      ${quoteIdentifier(batchProgramIdCol)}::int AS program_id,
      ${quoteIdentifier(batchCodeCol)}::text AS batch_code
    FROM batches
    ORDER BY ${quoteIdentifier(batchCodeCol)} ASC;
  `);

  return {
    programs,
    batches,
    statuses: ["ACTIVE", "INACTIVE", "DROPPED", "TRANSFERRED", "GRADUATED"],
  };
}

export async function getStudentVerificationList(params: {
  programId?: number | null;
  batchId?: number | null;
  status?: string;
  keyword?: string;
  limit?: number;
}) {
  const studentColumns = await getTableColumns("students");
  const enrollmentColumns = await getTableColumns("student_program_enrollments");
  const programColumns = await getTableColumns("programs");
  const batchColumns = await getTableColumns("batches");

  const studentIdCol = pickColumn(studentColumns, ["id"]) || "id";
  const officialStudentIdCol =
    pickColumn(studentColumns, [
      "student_id",
      "student_code",
      "student_no",
      "official_student_id",
    ]) || "student_id";

  const studentNameCol =
    pickColumn(studentColumns, ["full_name", "name", "student_name"]) ||
    "full_name";

  const studentPhoneCol = pickColumn(studentColumns, ["phone", "mobile"]);
  const studentEmailCol = pickColumn(studentColumns, ["email"]);
  const studentActiveCol = pickColumn(studentColumns, ["is_active"]);

  const enrollmentIdCol = pickColumn(enrollmentColumns, ["id"]) || "id";
  const enrollmentStudentIdCol =
    pickColumn(enrollmentColumns, [
      "student_id_ref",
      "student_id",
      "student_db_id",
      "student_record_id",
    ]) || "student_id_ref";
  const enrollmentProgramIdCol =
    pickColumn(enrollmentColumns, ["program_id"]) || "program_id";
  const enrollmentBatchIdCol =
    pickColumn(enrollmentColumns, ["batch_id"]) || "batch_id";
  const enrollmentStatusCol = pickColumn(enrollmentColumns, [
    "enrollment_status",
    "status",
    "student_status",
  ]);
  const enrollmentCurrentCol = pickColumn(enrollmentColumns, ["is_current"]);
  const admissionSemesterCol = pickColumn(enrollmentColumns, [
    "admission_semester",
    "admission_term",
    "admission_session",
    "session_label",
    "session",
    "academic_session",
  ]);

  const programIdCol = pickColumn(programColumns, ["id"]) || "id";
  const programLabelCol =
    pickColumn(programColumns, [
      "display_label",
      "short_name",
      "program_code",
      "code",
      "name",
      "program_title",
    ]) || "name";

  const batchIdCol = pickColumn(batchColumns, ["id"]) || "id";
  const batchCodeCol =
    pickColumn(batchColumns, ["batch_code", "code"]) || "batch_code";

  const where: string[] = [];

  if (params.programId) {
    where.push(
      `e.${quoteIdentifier(enrollmentProgramIdCol)} = ${sqlLiteral(
        params.programId
      )}`
    );
  }

  if (params.batchId) {
    where.push(
      `e.${quoteIdentifier(enrollmentBatchIdCol)} = ${sqlLiteral(
        params.batchId
      )}`
    );
  }

  if (params.status && enrollmentStatusCol) {
    where.push(
      `UPPER(e.${quoteIdentifier(enrollmentStatusCol)}::text) = ${sqlLiteral(
        params.status.toUpperCase()
      )}`
    );
  }

  if (params.keyword) {
    const keyword = `%${params.keyword.trim().toUpperCase().replace(/'/g, "''")}%`;

    where.push(`
      (
        UPPER(s.${quoteIdentifier(officialStudentIdCol)}::text) LIKE '${keyword}'
        OR UPPER(s.${quoteIdentifier(studentNameCol)}::text) LIKE '${keyword}'
        ${
          studentEmailCol
            ? `OR UPPER(COALESCE(s.${quoteIdentifier(
                studentEmailCol
              )}::text, '')) LIKE '${keyword}'`
            : ""
        }
        ${
          studentPhoneCol
            ? `OR UPPER(COALESCE(s.${quoteIdentifier(
                studentPhoneCol
              )}::text, '')) LIKE '${keyword}'`
            : ""
        }
      )
    `);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Number.isFinite(params.limit || 0)
    ? Math.min(Math.max(Number(params.limit || 100), 1), 500)
    : 100;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      student_db_id: number;
      student_official_id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      student_is_active: boolean | null;
      enrollment_id: number | null;
      program_id: number | null;
      program_label: string | null;
      batch_id: number | null;
      batch_code: string | null;
      admission_semester: string | null;
      enrollment_status: string | null;
      is_current: boolean | null;
      verification_status: string;
    }>
  >(`
    SELECT
      s.${quoteIdentifier(studentIdCol)}::int AS student_db_id,
      s.${quoteIdentifier(officialStudentIdCol)}::text AS student_official_id,
      s.${quoteIdentifier(studentNameCol)}::text AS full_name,
      ${studentPhoneCol ? `s.${quoteIdentifier(studentPhoneCol)}::text` : "NULL"} AS phone,
      ${studentEmailCol ? `s.${quoteIdentifier(studentEmailCol)}::text` : "NULL"} AS email,
      ${studentActiveCol ? `s.${quoteIdentifier(studentActiveCol)}::boolean` : "NULL"} AS student_is_active,
      e.${quoteIdentifier(enrollmentIdCol)}::int AS enrollment_id,
      p.${quoteIdentifier(programIdCol)}::int AS program_id,
      p.${quoteIdentifier(programLabelCol)}::text AS program_label,
      b.${quoteIdentifier(batchIdCol)}::int AS batch_id,
      b.${quoteIdentifier(batchCodeCol)}::text AS batch_code,
      ${
        admissionSemesterCol
          ? `e.${quoteIdentifier(admissionSemesterCol)}::text`
          : "NULL"
      } AS admission_semester,
      ${
        enrollmentStatusCol
          ? `e.${quoteIdentifier(enrollmentStatusCol)}::text`
          : "NULL"
      } AS enrollment_status,
      ${
        enrollmentCurrentCol
          ? `e.${quoteIdentifier(enrollmentCurrentCol)}::boolean`
          : "NULL"
      } AS is_current,
      CASE
        WHEN e.${quoteIdentifier(enrollmentIdCol)} IS NULL THEN 'NO_ENROLLMENT'
        WHEN p.${quoteIdentifier(programIdCol)} IS NULL THEN 'PROGRAM_MISSING'
        WHEN b.${quoteIdentifier(batchIdCol)} IS NULL THEN 'BATCH_MISSING'
        ELSE 'OK'
      END AS verification_status
    FROM students s
    LEFT JOIN student_program_enrollments e
      ON e.${quoteIdentifier(enrollmentStudentIdCol)} = s.${quoteIdentifier(
        studentIdCol
      )}
    LEFT JOIN programs p
      ON p.${quoteIdentifier(programIdCol)} = e.${quoteIdentifier(
        enrollmentProgramIdCol
      )}
    LEFT JOIN batches b
      ON b.${quoteIdentifier(batchIdCol)} = e.${quoteIdentifier(
        enrollmentBatchIdCol
      )}
    ${whereSql}
    ORDER BY s.${quoteIdentifier(officialStudentIdCol)} ASC
    LIMIT ${sqlLiteral(limit)};
  `);

  const summary = {
    totalRows: rows.length,
    okRows: rows.filter((row) => row.verification_status === "OK").length,
    noEnrollmentRows: rows.filter(
      (row) => row.verification_status === "NO_ENROLLMENT"
    ).length,
    programMissingRows: rows.filter(
      (row) => row.verification_status === "PROGRAM_MISSING"
    ).length,
    batchMissingRows: rows.filter(
      (row) => row.verification_status === "BATCH_MISSING"
    ).length,
  };

  return {
    summary,
    rows,
  };
}
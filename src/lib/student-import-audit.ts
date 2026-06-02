import { prisma } from "@/lib/prisma";

export type StudentImportAuditSummary = {
  totalRows: number;
  okRows: number;
  warningRows: number;
  errorRows: number;
  existingStudents?: number;
  newStudents?: number;
  batchesToCreate?: number;
  existingEnrollments?: number;
};

export type StudentImportCommitStats = {
  totalRows: number;
  createdStudents: number;
  updatedStudents: number;
  createdBatches: number;
  createdEnrollments: number;
  updatedEnrollments: number;
  skippedRows: number;
  errors: string[];
};

export type StudentImportAuditRow = {
  rowNumber: number;
  studentId: string;
  fullName: string;
  programCode: string;
  batchCode: string;
  status: string;
  issues: string[];
  rawPayload?: unknown;
};

export type StudentImportLogRow = {
  id: number;
  import_type: string;
  file_name: string | null;
  file_size: number | null;
  total_rows: number;
  ok_rows: number;
  warning_rows: number;
  error_rows: number;
  committed_rows: number;
  created_students: number;
  updated_students: number;
  created_batches: number;
  created_enrollments: number;
  updated_enrollments: number;
  skipped_rows: number;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentImportErrorRow = {
  id: number;
  import_log_id: number;
  row_number: number;
  student_id: string | null;
  full_name: string | null;
  program_code: string | null;
  batch_code: string | null;
  status: string;
  issues: string | null;
  raw_payload: unknown;
  created_at: string;
};

type ImportChangeRow = {
  id: number;
  import_log_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  previous_payload: Record<string, unknown> | null;
  new_payload: Record<string, unknown> | null;
};

function sqlLiteral(value: unknown) {
  if (value === null || value === undefined || value === "") return "NULL";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  const text = String(value).replace(/'/g, "''");
  return `'${text}'`;
}

function jsonbLiteral(value: unknown) {
  const text = JSON.stringify(value ?? null).replace(/'/g, "''");
  return `'${text}'::jsonb`;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function ensureStudentImportAuditTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_import_logs (
      id SERIAL PRIMARY KEY,
      import_type VARCHAR(80) NOT NULL DEFAULT 'STUDENT_BULK_IMPORT',
      file_name TEXT NULL,
      file_size INTEGER NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      ok_rows INTEGER NOT NULL DEFAULT 0,
      warning_rows INTEGER NOT NULL DEFAULT 0,
      error_rows INTEGER NOT NULL DEFAULT 0,
      committed_rows INTEGER NOT NULL DEFAULT 0,
      created_students INTEGER NOT NULL DEFAULT 0,
      updated_students INTEGER NOT NULL DEFAULT 0,
      created_batches INTEGER NOT NULL DEFAULT 0,
      created_enrollments INTEGER NOT NULL DEFAULT 0,
      updated_enrollments INTEGER NOT NULL DEFAULT 0,
      skipped_rows INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'STARTED',
      message TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_import_error_rows (
      id SERIAL PRIMARY KEY,
      import_log_id INTEGER NOT NULL REFERENCES student_import_logs(id) ON DELETE CASCADE,
      row_number INTEGER NOT NULL,
      student_id TEXT NULL,
      full_name TEXT NULL,
      program_code TEXT NULL,
      batch_code TEXT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'ERROR',
      issues TEXT NULL,
      raw_payload JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_import_change_rows (
      id SERIAL PRIMARY KEY,
      import_log_id INTEGER NOT NULL REFERENCES student_import_logs(id) ON DELETE CASCADE,
      entity_type VARCHAR(80) NOT NULL,
      entity_id INTEGER NOT NULL,
      action VARCHAR(30) NOT NULL,
      previous_payload JSONB NULL,
      new_payload JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_student_import_logs_created_at
    ON student_import_logs(created_at DESC);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_student_import_error_rows_log_id
    ON student_import_error_rows(import_log_id);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_student_import_change_rows_log_id
    ON student_import_change_rows(import_log_id);
  `);
}

export async function createStudentImportLog(params: {
  fileName?: string | null;
  fileSize?: number | null;
  summary: StudentImportAuditSummary;
  status?: string;
  message?: string | null;
}) {
  await ensureStudentImportAuditTables();

  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(`
    INSERT INTO student_import_logs (
      import_type,
      file_name,
      file_size,
      total_rows,
      ok_rows,
      warning_rows,
      error_rows,
      status,
      message
    )
    VALUES (
      'STUDENT_BULK_IMPORT',
      ${sqlLiteral(params.fileName || null)},
      ${sqlLiteral(params.fileSize || null)},
      ${sqlLiteral(params.summary.totalRows || 0)},
      ${sqlLiteral(params.summary.okRows || 0)},
      ${sqlLiteral(params.summary.warningRows || 0)},
      ${sqlLiteral(params.summary.errorRows || 0)},
      ${sqlLiteral(params.status || "STARTED")},
      ${sqlLiteral(params.message || null)}
    )
    RETURNING id::int AS id;
  `);

  return Number(rows[0].id);
}

export async function updateStudentImportLog(
  importLogId: number,
  params: {
    status: string;
    message?: string | null;
    stats?: Partial<StudentImportCommitStats>;
  }
) {
  await ensureStudentImportAuditTables();

  const stats = params.stats || {};

  await prisma.$executeRawUnsafe(`
    UPDATE student_import_logs
    SET
      committed_rows = ${sqlLiteral(
        Math.max(
          0,
          Number(stats.totalRows || 0) - Number(stats.skippedRows || 0)
        )
      )},
      created_students = ${sqlLiteral(stats.createdStudents || 0)},
      updated_students = ${sqlLiteral(stats.updatedStudents || 0)},
      created_batches = ${sqlLiteral(stats.createdBatches || 0)},
      created_enrollments = ${sqlLiteral(stats.createdEnrollments || 0)},
      updated_enrollments = ${sqlLiteral(stats.updatedEnrollments || 0)},
      skipped_rows = ${sqlLiteral(stats.skippedRows || 0)},
      status = ${sqlLiteral(params.status)},
      message = ${sqlLiteral(params.message || null)},
      updated_at = NOW()
    WHERE id = ${sqlLiteral(importLogId)};
  `);
}

export async function trackStudentImportChange(params: {
  importLogId: number;
  entityType: "STUDENT" | "BATCH" | "ENROLLMENT";
  entityId: number;
  action: "CREATE" | "UPDATE";
  previousPayload: unknown | null;
  newPayload: unknown | null;
}) {
  await ensureStudentImportAuditTables();

  await prisma.$executeRawUnsafe(`
    INSERT INTO student_import_change_rows (
      import_log_id,
      entity_type,
      entity_id,
      action,
      previous_payload,
      new_payload
    )
    VALUES (
      ${sqlLiteral(params.importLogId)},
      ${sqlLiteral(params.entityType)},
      ${sqlLiteral(params.entityId)},
      ${sqlLiteral(params.action)},
      ${jsonbLiteral(params.previousPayload)},
      ${jsonbLiteral(params.newPayload)}
    );
  `);
}

export async function replaceStudentImportErrorRows(
  importLogId: number,
  rows: StudentImportAuditRow[]
) {
  await ensureStudentImportAuditTables();

  await prisma.$executeRawUnsafe(`
    DELETE FROM student_import_error_rows
    WHERE import_log_id = ${sqlLiteral(importLogId)};
  `);

  for (const row of rows) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO student_import_error_rows (
        import_log_id,
        row_number,
        student_id,
        full_name,
        program_code,
        batch_code,
        status,
        issues,
        raw_payload
      )
      VALUES (
        ${sqlLiteral(importLogId)},
        ${sqlLiteral(row.rowNumber || 0)},
        ${sqlLiteral(row.studentId || null)},
        ${sqlLiteral(row.fullName || null)},
        ${sqlLiteral(row.programCode || null)},
        ${sqlLiteral(row.batchCode || null)},
        ${sqlLiteral(row.status || "ERROR")},
        ${sqlLiteral((row.issues || []).join(" | "))},
        ${jsonbLiteral(row.rawPayload || row)}
      );
    `);
  }
}

export async function listStudentImportLogs(limit = 20) {
  await ensureStudentImportAuditTables();

  return prisma.$queryRawUnsafe<StudentImportLogRow[]>(`
    SELECT
      id::int,
      import_type,
      file_name,
      file_size,
      total_rows::int,
      ok_rows::int,
      warning_rows::int,
      error_rows::int,
      committed_rows::int,
      created_students::int,
      updated_students::int,
      created_batches::int,
      created_enrollments::int,
      updated_enrollments::int,
      skipped_rows::int,
      status,
      message,
      created_at::text,
      updated_at::text
    FROM student_import_logs
    ORDER BY created_at DESC
    LIMIT ${sqlLiteral(limit)};
  `);
}

export async function listStudentImportErrorRows(importLogId: number) {
  await ensureStudentImportAuditTables();

  return prisma.$queryRawUnsafe<StudentImportErrorRow[]>(`
    SELECT
      id::int,
      import_log_id::int,
      row_number::int,
      student_id,
      full_name,
      program_code,
      batch_code,
      status,
      issues,
      raw_payload,
      created_at::text
    FROM student_import_error_rows
    WHERE import_log_id = ${sqlLiteral(importLogId)}
    ORDER BY row_number ASC, id ASC;
  `);
}

export function buildStudentImportErrorCsv(rows: StudentImportErrorRow[]) {
  const headers = [
    "Row Number",
    "Student ID",
    "Full Name",
    "Program Code",
    "Batch Code",
    "Status",
    "Issues",
  ];

  const lines = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.row_number,
        row.student_id || "",
        row.full_name || "",
        row.program_code || "",
        row.batch_code || "",
        row.status,
        row.issues || "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return lines.join("\n");
}

function tableNameForEntity(entityType: string) {
  if (entityType === "STUDENT") return "students";
  if (entityType === "BATCH") return "batches";
  if (entityType === "ENROLLMENT") return "student_program_enrollments";
  throw new Error(`Unsupported rollback entity type: ${entityType}`);
}

async function restoreRow(tableName: string, entityId: number, payload: Record<string, unknown>) {
  const keys = Object.keys(payload).filter((key) => key !== "id");

  if (keys.length === 0) return;

  await prisma.$executeRawUnsafe(`
    UPDATE ${quoteIdentifier(tableName)}
    SET ${keys
      .map((key) => `${quoteIdentifier(key)} = ${sqlLiteral(payload[key])}`)
      .join(", ")}
    WHERE id = ${sqlLiteral(entityId)};
  `);
}

export async function rollbackStudentImport(importLogId: number) {
  await ensureStudentImportAuditTables();

  const logRows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(`
    SELECT status
    FROM student_import_logs
    WHERE id = ${sqlLiteral(importLogId)}
    LIMIT 1;
  `);

  if (!logRows.length) {
    throw new Error("Import log not found.");
  }

  if (logRows[0].status === "ROLLED_BACK") {
    throw new Error("This import has already been rolled back.");
  }

  const changes = await prisma.$queryRawUnsafe<ImportChangeRow[]>(`
    SELECT
      id::int,
      import_log_id::int,
      entity_type,
      entity_id::int,
      action,
      previous_payload,
      new_payload
    FROM student_import_change_rows
    WHERE import_log_id = ${sqlLiteral(importLogId)}
    ORDER BY id DESC;
  `);

  if (!changes.length) {
    throw new Error(
      "No tracked changes found for this import. Only imports committed after rollback tracking was added can be rolled back automatically."
    );
  }

  let revertedCreates = 0;
  let revertedUpdates = 0;
  const errors: string[] = [];

  for (const change of changes) {
    const tableName = tableNameForEntity(change.entity_type);

    try {
      if (change.action === "CREATE") {
        await prisma.$executeRawUnsafe(`
          DELETE FROM ${quoteIdentifier(tableName)}
          WHERE id = ${sqlLiteral(change.entity_id)};
        `);

        revertedCreates += 1;
      } else if (change.action === "UPDATE") {
        if (!change.previous_payload) {
          throw new Error("Missing previous payload for update rollback.");
        }

        await restoreRow(tableName, change.entity_id, change.previous_payload);
        revertedUpdates += 1;
      }
    } catch (error) {
      errors.push(
        `${change.entity_type} #${change.entity_id}: ${
          error instanceof Error ? error.message : "Rollback failed."
        }`
      );
    }
  }

  if (errors.length > 0) {
    await prisma.$executeRawUnsafe(`
      UPDATE student_import_logs
      SET
        status = 'ROLLBACK_PARTIAL',
        message = ${sqlLiteral(errors.join(" | "))},
        updated_at = NOW()
      WHERE id = ${sqlLiteral(importLogId)};
    `);

    return {
      success: false,
      revertedCreates,
      revertedUpdates,
      errors,
    };
  }

  await prisma.$executeRawUnsafe(`
    UPDATE student_import_logs
    SET
      status = 'ROLLED_BACK',
      message = 'Import rollback completed successfully.',
      updated_at = NOW()
    WHERE id = ${sqlLiteral(importLogId)};
  `);

  return {
    success: true,
    revertedCreates,
    revertedUpdates,
    errors: [],
  };
}
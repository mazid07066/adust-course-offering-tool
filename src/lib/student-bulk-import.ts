import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export type StudentImportRawRow = {
  rowNumber: number;
  studentId: string;
  fullName: string;
  programCode: string;
  batchCode: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  session: string;
  enrollmentStatus: string;
};

export type StudentImportPreviewRow = StudentImportRawRow & {
  normalizedStudentId: string;
  inferredBatchCode: string;
  matchedProgramId: number | null;
  matchedProgramLabel: string;
  matchedBatchId: number | null;
  willCreateBatch: boolean;
  existingStudentId: number | null;
  existingEnrollmentId: number | null;
  status: "OK" | "WARNING" | "ERROR";
  issues: string[];
};

export type StudentImportCommitResult = {
  totalRows: number;
  createdStudents: number;
  updatedStudents: number;
  createdBatches: number;
  createdEnrollments: number;
  updatedEnrollments: number;
  skippedRows: number;
  errors: string[];
};

type DbColumnRow = {
  column_name: string;
};

type GenericRecord = Record<string, unknown>;

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanUpper(value: unknown) {
  return clean(value).toUpperCase();
}

function normalizeHeader(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeStudentId(value: unknown) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeProgramCode(value: unknown) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function inferBatchCodeFromStudentId(studentId: string) {
  const normalized = normalizeStudentId(studentId);
  const match = normalized.match(/^([0-9]{2,3})[-/]/);
  if (match?.[1]) return match[1];
  const compactMatch = normalized.match(/^([0-9]{2,3})/);
  return compactMatch?.[1] || "";
}

function parseDate(value: string) {
  const cleaned = clean(value);
  if (!cleaned) return "";

  const date = new Date(cleaned);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  return "";
}

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
  const rows = await prisma.$queryRawUnsafe<DbColumnRow[]>(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${sqlLiteral(tableName)}
    ORDER BY ordinal_position
    `
  );

  return new Set(rows.map((row) => row.column_name));
}

async function findProgram(programCode: string) {
  const columns = await getTableColumns("programs");

  const idCol = pickColumn(columns, ["id"]);
  if (!idCol) {
    throw new Error("programs.id column not found.");
  }

  const searchableColumns = [
    "short_name",
    "program_code",
    "code",
    "name",
    "display_label",
    "program_title",
  ].filter((col) => columns.has(col));

  if (searchableColumns.length === 0) {
    throw new Error(
      "No searchable program column found. Expected one of short_name, program_code, code, name, display_label, program_title."
    );
  }

  const normalized = normalizeProgramCode(programCode);

  const where = searchableColumns
    .map(
      (col) =>
        `UPPER(REPLACE(COALESCE(${quoteIdentifier(col)}::text, ''), ' ', '')) = ${sqlLiteral(
          normalized
        )}`
    )
    .join(" OR ");

  const labelExpression = searchableColumns
    .map((col) => `NULLIF(${quoteIdentifier(col)}::text, '')`)
    .join(", ");

  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: number; label: string | null }>
  >(
    `
    SELECT ${quoteIdentifier(idCol)}::int AS id,
           COALESCE(${labelExpression}) AS label
    FROM programs
    WHERE ${where}
    ORDER BY ${quoteIdentifier(idCol)} ASC
    LIMIT 1
    `
  );

  if (!rows.length) {
    return null;
  }

  return {
    id: Number(rows[0].id),
    label: rows[0].label || programCode,
  };
}

async function findOrCreateBatch(programId: number, batchCode: string) {
  const columns = await getTableColumns("batches");

  const idCol = pickColumn(columns, ["id"]);
  const programIdCol = pickColumn(columns, ["program_id"]);
  const batchCodeCol = pickColumn(columns, ["batch_code", "code"]);

  if (!idCol || !programIdCol || !batchCodeCol) {
    throw new Error(
      "batches table must contain id, program_id, and batch_code/code columns."
    );
  }

  const normalizedBatchCode = cleanUpper(batchCode);

  const existing = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
    SELECT ${quoteIdentifier(idCol)}::int AS id
    FROM batches
    WHERE ${quoteIdentifier(programIdCol)} = ${sqlLiteral(programId)}
      AND UPPER(${quoteIdentifier(batchCodeCol)}::text) = ${sqlLiteral(normalizedBatchCode)}
    LIMIT 1
    `
  );

  if (existing.length) {
    return {
      id: Number(existing[0].id),
      created: false,
    };
  }

  const insertData: Record<string, unknown> = {
    [programIdCol]: programId,
    [batchCodeCol]: normalizedBatchCode,
  };

  if (columns.has("is_active")) insertData.is_active = true;
  if (columns.has("created_at")) insertData.created_at = new Date().toISOString();
  if (columns.has("updated_at")) insertData.updated_at = new Date().toISOString();

  const keys = Object.keys(insertData);
  const inserted = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
    INSERT INTO batches (${keys.map(quoteIdentifier).join(", ")})
    VALUES (${keys.map((key) => sqlLiteral(insertData[key])).join(", ")})
    RETURNING ${quoteIdentifier(idCol)}::int AS id
    `
  );

  return {
    id: Number(inserted[0].id),
    created: true,
  };
}

async function findBatch(programId: number, batchCode: string) {
  const columns = await getTableColumns("batches");

  const idCol = pickColumn(columns, ["id"]);
  const programIdCol = pickColumn(columns, ["program_id"]);
  const batchCodeCol = pickColumn(columns, ["batch_code", "code"]);

  if (!idCol || !programIdCol || !batchCodeCol) {
    throw new Error(
      "batches table must contain id, program_id, and batch_code/code columns."
    );
  }

  const normalizedBatchCode = cleanUpper(batchCode);

  const existing = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
    SELECT ${quoteIdentifier(idCol)}::int AS id
    FROM batches
    WHERE ${quoteIdentifier(programIdCol)} = ${sqlLiteral(programId)}
      AND UPPER(${quoteIdentifier(batchCodeCol)}::text) = ${sqlLiteral(normalizedBatchCode)}
    LIMIT 1
    `
  );

  return existing.length ? Number(existing[0].id) : null;
}

async function findStudentByOfficialId(studentId: string) {
  const columns = await getTableColumns("students");

  const idCol = pickColumn(columns, ["id"]);
  const officialIdCol = pickColumn(columns, [
    "student_id",
    "student_code",
    "student_no",
    "official_student_id",
  ]);

  if (!idCol || !officialIdCol) {
    throw new Error(
      "students table must contain id and student_id/student_code/student_no column."
    );
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
    SELECT ${quoteIdentifier(idCol)}::int AS id
    FROM students
    WHERE UPPER(${quoteIdentifier(officialIdCol)}::text) = ${sqlLiteral(
      normalizeStudentId(studentId)
    )}
    LIMIT 1
    `
  );

  return rows.length ? Number(rows[0].id) : null;
}

async function upsertStudent(row: StudentImportPreviewRow) {
  const columns = await getTableColumns("students");

  const idCol = pickColumn(columns, ["id"]);
  const officialIdCol = pickColumn(columns, [
    "student_id",
    "student_code",
    "student_no",
    "official_student_id",
  ]);

  if (!idCol || !officialIdCol) {
    throw new Error(
      "students table must contain id and student_id/student_code/student_no column."
    );
  }

  const existingId = await findStudentByOfficialId(row.normalizedStudentId);

  const data: Record<string, unknown> = {
    [officialIdCol]: row.normalizedStudentId,
  };

  if (columns.has("full_name")) data.full_name = row.fullName;
  if (columns.has("name")) data.name = row.fullName;
  if (columns.has("gender")) data.gender = row.gender || null;
  if (columns.has("date_of_birth")) data.date_of_birth = parseDate(row.dateOfBirth) || null;
  if (columns.has("phone")) data.phone = row.phone || null;
  if (columns.has("mobile")) data.mobile = row.phone || null;
  if (columns.has("email")) data.email = row.email || null;
  if (columns.has("address")) data.address = row.address || null;
  if (columns.has("present_address")) data.present_address = row.address || null;
  if (columns.has("is_active")) data.is_active = true;
  if (columns.has("updated_at")) data.updated_at = new Date().toISOString();

  if (existingId) {
    const updateKeys = Object.keys(data).filter((key) => key !== officialIdCol);

    if (updateKeys.length) {
      await prisma.$executeRawUnsafe(
        `
        UPDATE students
        SET ${updateKeys
          .map((key) => `${quoteIdentifier(key)} = ${sqlLiteral(data[key])}`)
          .join(", ")}
        WHERE ${quoteIdentifier(idCol)} = ${sqlLiteral(existingId)}
        `
      );
    }

    return {
      id: existingId,
      created: false,
    };
  }

  if (columns.has("created_at")) data.created_at = new Date().toISOString();

  const keys = Object.keys(data);

  const inserted = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
    INSERT INTO students (${keys.map(quoteIdentifier).join(", ")})
    VALUES (${keys.map((key) => sqlLiteral(data[key])).join(", ")})
    RETURNING ${quoteIdentifier(idCol)}::int AS id
    `
  );

  return {
    id: Number(inserted[0].id),
    created: true,
  };
}

async function findEnrollment(studentDbId: number, programId: number) {
  const columns = await getTableColumns("student_program_enrollments");

  const idCol = pickColumn(columns, ["id"]);
  const studentFkCol = pickColumn(columns, [
    "student_id",
    "student_db_id",
    "student_record_id",
  ]);
  const programIdCol = pickColumn(columns, ["program_id"]);
  const batchIdCol = pickColumn(columns, ["batch_id"]);

  if (!idCol || !studentFkCol || !programIdCol || !batchIdCol) {
    throw new Error(
      "student_program_enrollments table must contain id, student_id, program_id, and batch_id columns."
    );
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
    SELECT ${quoteIdentifier(idCol)}::int AS id
    FROM student_program_enrollments
    WHERE ${quoteIdentifier(studentFkCol)} = ${sqlLiteral(studentDbId)}
      AND ${quoteIdentifier(programIdCol)} = ${sqlLiteral(programId)}
    ORDER BY ${quoteIdentifier(idCol)} DESC
    LIMIT 1
    `
  );

  return rows.length ? Number(rows[0].id) : null;
}

async function upsertEnrollment(params: {
  studentDbId: number;
  programId: number;
  batchId: number;
  session: string;
  status: string;
}) {
  const columns = await getTableColumns("student_program_enrollments");

  const idCol = pickColumn(columns, ["id"]);
  const studentFkCol = pickColumn(columns, [
    "student_id",
    "student_db_id",
    "student_record_id",
  ]);
  const programIdCol = pickColumn(columns, ["program_id"]);
  const batchIdCol = pickColumn(columns, ["batch_id"]);
  const statusCol = pickColumn(columns, [
    "enrollment_status",
    "status",
    "student_status",
  ]);
  const sessionCol = pickColumn(columns, [
    "session_label",
    "session",
    "academic_session",
  ]);

  if (!idCol || !studentFkCol || !programIdCol || !batchIdCol) {
    throw new Error(
      "student_program_enrollments table must contain id, student_id, program_id, and batch_id columns."
    );
  }

  const existingId = await findEnrollment(params.studentDbId, params.programId);

  const normalizedStatus = cleanUpper(params.status || "ACTIVE") || "ACTIVE";

  const data: Record<string, unknown> = {
    [studentFkCol]: params.studentDbId,
    [programIdCol]: params.programId,
    [batchIdCol]: params.batchId,
  };

  if (statusCol) data[statusCol] = normalizedStatus;
  if (sessionCol) data[sessionCol] = params.session || null;
  if (columns.has("is_current")) data.is_current = true;
  if (columns.has("updated_at")) data.updated_at = new Date().toISOString();

  if (existingId) {
    const updateKeys = Object.keys(data).filter(
      (key) => key !== studentFkCol && key !== programIdCol
    );

    if (updateKeys.length) {
      await prisma.$executeRawUnsafe(
        `
        UPDATE student_program_enrollments
        SET ${updateKeys
          .map((key) => `${quoteIdentifier(key)} = ${sqlLiteral(data[key])}`)
          .join(", ")}
        WHERE ${quoteIdentifier(idCol)} = ${sqlLiteral(existingId)}
        `
      );
    }

    return {
      id: existingId,
      created: false,
    };
  }

  if (columns.has("created_at")) data.created_at = new Date().toISOString();

  const keys = Object.keys(data);

  const inserted = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `
    INSERT INTO student_program_enrollments (${keys.map(quoteIdentifier).join(", ")})
    VALUES (${keys.map((key) => sqlLiteral(data[key])).join(", ")})
    RETURNING ${quoteIdentifier(idCol)}::int AS id
    `
  );

  return {
    id: Number(inserted[0].id),
    created: true,
  };
}

function mapRecordToImportRow(record: GenericRecord, index: number): StudentImportRawRow {
  const normalizedMap = new Map<string, unknown>();

  for (const [key, value] of Object.entries(record)) {
    normalizedMap.set(normalizeHeader(key), value);
  }

  function get(...keys: string[]) {
    for (const key of keys) {
      const value = normalizedMap.get(normalizeHeader(key));
      if (value !== undefined && value !== null && clean(value) !== "") {
        return clean(value);
      }
    }
    return "";
  }

  const studentId = normalizeStudentId(
    get("Student ID", "StudentId", "Student No", "Student Code", "ID")
  );

  const batchCode =
    cleanUpper(get("Batch Code", "Batch", "Batch No")) ||
    inferBatchCodeFromStudentId(studentId);

  return {
    rowNumber: index + 2,
    studentId,
    fullName: get("Full Name", "Name", "Student Name"),
    programCode: normalizeProgramCode(
      get("Program Code", "Program", "Program Short Name", "Academic Identity")
    ),
    batchCode,
    gender: cleanUpper(get("Gender", "Sex")),
    dateOfBirth: get("Date of Birth", "DOB", "Birth Date"),
    phone: get("Phone", "Mobile", "Contact", "Contact No"),
    email: get("Email", "Email Address"),
    address: get("Address", "Present Address"),
    session: get("Session", "Academic Session"),
    enrollmentStatus: cleanUpper(
      get("Enrollment Status", "Status", "Student Status")
    ) || "ACTIVE",
  };
}

export async function parseStudentImportFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    cellNF: false,
    cellText: true,
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("No worksheet found in the uploaded file.");
  }

  const sheet = workbook.Sheets[sheetName];

  const records = XLSX.utils.sheet_to_json<GenericRecord>(sheet, {
    defval: "",
    raw: false,
  });

  return records
    .map((record, index) => mapRecordToImportRow(record, index))
    .filter((row) => row.studentId || row.fullName || row.programCode);
}

export async function buildStudentImportPreview(rows: StudentImportRawRow[]) {
  const previewRows: StudentImportPreviewRow[] = [];

  const seenStudentIds = new Set<string>();

  for (const row of rows) {
    const normalizedStudentId = normalizeStudentId(row.studentId);
    const inferredBatchCode = row.batchCode || inferBatchCodeFromStudentId(row.studentId);
    const issues: string[] = [];

    if (!normalizedStudentId) issues.push("Student ID is required.");
    if (!row.fullName) issues.push("Full Name is required.");
    if (!row.programCode) issues.push("Program Code is required.");
    if (!inferredBatchCode) issues.push("Batch Code is required or must be inferable from Student ID.");

    if (normalizedStudentId && seenStudentIds.has(normalizedStudentId)) {
      issues.push("Duplicate Student ID inside uploaded file.");
    }

    if (normalizedStudentId) {
      seenStudentIds.add(normalizedStudentId);
    }

    let matchedProgramId: number | null = null;
    let matchedProgramLabel = "";
    let matchedBatchId: number | null = null;
    let willCreateBatch = false;
    let existingStudentId: number | null = null;
    let existingEnrollmentId: number | null = null;

    if (row.programCode) {
      const program = await findProgram(row.programCode);

      if (!program) {
        issues.push(`Program not found for code: ${row.programCode}`);
      } else {
        matchedProgramId = program.id;
        matchedProgramLabel = program.label;
      }
    }

    if (matchedProgramId && inferredBatchCode) {
      matchedBatchId = await findBatch(matchedProgramId, inferredBatchCode);
      willCreateBatch = !matchedBatchId;
    }

    if (normalizedStudentId) {
      existingStudentId = await findStudentByOfficialId(normalizedStudentId);
    }

    if (existingStudentId && matchedProgramId) {
      existingEnrollmentId = await findEnrollment(existingStudentId, matchedProgramId);
    }

    const hasError = issues.some((issue) =>
      [
        "Student ID is required.",
        "Full Name is required.",
        "Program Code is required.",
      ].includes(issue) || issue.startsWith("Program not found")
    );

    previewRows.push({
      ...row,
      normalizedStudentId,
      inferredBatchCode,
      matchedProgramId,
      matchedProgramLabel,
      matchedBatchId,
      willCreateBatch,
      existingStudentId,
      existingEnrollmentId,
      status: hasError ? "ERROR" : willCreateBatch ? "WARNING" : "OK",
      issues,
    });
  }

  return previewRows;
}

export async function commitStudentImportRows(rows: StudentImportPreviewRow[]) {
  const result: StudentImportCommitResult = {
    totalRows: rows.length,
    createdStudents: 0,
    updatedStudents: 0,
    createdBatches: 0,
    createdEnrollments: 0,
    updatedEnrollments: 0,
    skippedRows: 0,
    errors: [],
  };

  for (const row of rows) {
    try {
      if (row.status === "ERROR" || !row.matchedProgramId) {
        result.skippedRows += 1;
        result.errors.push(
          `Row ${row.rowNumber}: skipped because validation failed. ${row.issues.join(" ")}`
        );
        continue;
      }

      const student = await upsertStudent(row);

      if (student.created) {
        result.createdStudents += 1;
      } else {
        result.updatedStudents += 1;
      }

      const batch = await findOrCreateBatch(row.matchedProgramId, row.inferredBatchCode);

      if (batch.created) {
        result.createdBatches += 1;
      }

      const enrollment = await upsertEnrollment({
        studentDbId: student.id,
        programId: row.matchedProgramId,
        batchId: batch.id,
        session: row.session,
        status: row.enrollmentStatus || "ACTIVE",
      });

      if (enrollment.created) {
        result.createdEnrollments += 1;
      } else {
        result.updatedEnrollments += 1;
      }
    } catch (error) {
      result.skippedRows += 1;
      result.errors.push(
        `Row ${row.rowNumber}: ${
          error instanceof Error ? error.message : "Unknown import error."
        }`
      );
    }
  }

  return result;
}
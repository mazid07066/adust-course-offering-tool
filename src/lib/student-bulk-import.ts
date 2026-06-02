import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { trackStudentImportChange } from "@/lib/student-import-audit";

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
  admissionSemester: string;
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

function normalizeAdmissionSemester(value: unknown) {
  return cleanUpper(value);
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
  if (!cleaned) return null;

  const date = new Date(cleaned);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return null;
}

async function findProgram(programCode: string) {
  const normalized = normalizeProgramCode(programCode);

  return prisma.programs.findFirst({
    where: {
      OR: [
        { short_name: { equals: normalized, mode: "insensitive" } },
        { name: { equals: programCode, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      short_name: true,
      name: true,
    },
  });
}

async function findBatch(programId: number, batchCode: string) {
  return prisma.batches.findFirst({
    where: {
      program_id: programId,
      batch_code: cleanUpper(batchCode),
    },
    select: {
      id: true,
    },
  });
}

async function findStudentByOfficialId(studentId: string) {
  return prisma.students.findUnique({
    where: {
      student_id: normalizeStudentId(studentId),
    },
    select: {
      id: true,
    },
  });
}

async function findEnrollment(studentIdRef: number, programId: number, batchId: number) {
  return prisma.student_program_enrollments.findFirst({
    where: {
      student_id_ref: studentIdRef,
      program_id: programId,
      batch_id: batchId,
    },
    select: {
      id: true,
    },
  });
}

async function upsertStudent(row: StudentImportPreviewRow, importLogId?: number | null) {
  const normalizedStudentId = normalizeStudentId(row.normalizedStudentId);
  const normalizedAdmissionSemester = normalizeAdmissionSemester(row.admissionSemester);
  const normalizedStatus = cleanUpper(row.enrollmentStatus || "ACTIVE") || "ACTIVE";

  const existing = await prisma.students.findUnique({
    where: { student_id: normalizedStudentId },
  });

  if (existing) {
    const previousPayload = { ...existing };

    const updated = await prisma.students.update({
      where: { id: existing.id },
      data: {
        full_name: row.fullName,
        gender: row.gender || null,
        date_of_birth: parseDate(row.dateOfBirth),
        email: row.email || null,
        phone: row.phone || null,
        present_address: row.address || null,
        admission_term_name: normalizedAdmissionSemester || null,
        current_status: normalizedStatus,
      },
    });

    if (importLogId) {
      await trackStudentImportChange({
        importLogId,
        entityType: "STUDENT",
        entityId: updated.id,
        action: "UPDATE",
        previousPayload,
        newPayload: updated,
      });
    }

    return {
      id: updated.id,
      created: false,
    };
  }

  const created = await prisma.students.create({
    data: {
      student_id: normalizedStudentId,
      full_name: row.fullName,
      gender: row.gender || null,
      date_of_birth: parseDate(row.dateOfBirth),
      email: row.email || null,
      phone: row.phone || null,
      present_address: row.address || null,
      admission_term_name: normalizedAdmissionSemester || null,
      current_status: normalizedStatus,
    },
  });

  if (importLogId) {
    await trackStudentImportChange({
      importLogId,
      entityType: "STUDENT",
      entityId: created.id,
      action: "CREATE",
      previousPayload: null,
      newPayload: created,
    });
  }

  return {
    id: created.id,
    created: true,
  };
}

async function findOrCreateBatch(
  programId: number,
  batchCode: string,
  admissionSemester: string,
  importLogId?: number | null
) {
  const normalizedBatchCode = cleanUpper(batchCode);
  const normalizedAdmissionSemester = normalizeAdmissionSemester(admissionSemester);

  const existing = await prisma.batches.findFirst({
    where: {
      program_id: programId,
      batch_code: normalizedBatchCode,
    },
  });

  if (existing) {
    if (!existing.admission_term && normalizedAdmissionSemester) {
      const previousPayload = { ...existing };

      const updated = await prisma.batches.update({
        where: { id: existing.id },
        data: {
          admission_term: normalizedAdmissionSemester,
        },
      });

      if (importLogId) {
        await trackStudentImportChange({
          importLogId,
          entityType: "BATCH",
          entityId: updated.id,
          action: "UPDATE",
          previousPayload,
          newPayload: updated,
        });
      }
    }

    return {
      id: existing.id,
      created: false,
    };
  }

  const created = await prisma.batches.create({
    data: {
      program_id: programId,
      batch_code: normalizedBatchCode,
      admission_term: normalizedAdmissionSemester || null,
      is_active: true,
    },
  });

  if (importLogId) {
    await trackStudentImportChange({
      importLogId,
      entityType: "BATCH",
      entityId: created.id,
      action: "CREATE",
      previousPayload: null,
      newPayload: created,
    });
  }

  return {
    id: created.id,
    created: true,
  };
}

async function upsertEnrollment(params: {
  studentDbId: number;
  programId: number;
  batchId: number;
  admissionSemester: string;
  status: string;
  importLogId?: number | null;
}) {
  const normalizedAdmissionSemester = normalizeAdmissionSemester(params.admissionSemester);
  const normalizedStatus = cleanUpper(params.status || "ACTIVE") || "ACTIVE";

  const existing = await prisma.student_program_enrollments.findFirst({
    where: {
      student_id_ref: params.studentDbId,
      program_id: params.programId,
      batch_id: params.batchId,
    },
  });

  if (existing) {
    const previousPayload = { ...existing };

    const updated = await prisma.student_program_enrollments.update({
      where: { id: existing.id },
      data: {
        admission_semester: normalizedAdmissionSemester || null,
        enrollment_status: normalizedStatus,
      },
    });

    if (params.importLogId) {
      await trackStudentImportChange({
        importLogId: params.importLogId,
        entityType: "ENROLLMENT",
        entityId: updated.id,
        action: "UPDATE",
        previousPayload,
        newPayload: updated,
      });
    }

    return {
      id: updated.id,
      created: false,
    };
  }

  const created = await prisma.student_program_enrollments.create({
    data: {
      student_id_ref: params.studentDbId,
      program_id: params.programId,
      batch_id: params.batchId,
      admission_semester: normalizedAdmissionSemester || null,
      enrollment_status: normalizedStatus,
    },
  });

  if (params.importLogId) {
    await trackStudentImportChange({
      importLogId: params.importLogId,
      entityType: "ENROLLMENT",
      entityId: created.id,
      action: "CREATE",
      previousPayload: null,
      newPayload: created,
    });
  }

  return {
    id: created.id,
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
    admissionSemester: normalizeAdmissionSemester(
      get(
        "Admission Semester",
        "Admission Term",
        "Admission Session",
        "Session",
        "Academic Session"
      )
    ),
    enrollmentStatus:
      cleanUpper(get("Enrollment Status", "Status", "Student Status")) ||
      "ACTIVE",
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
    const inferredBatchCode =
      row.batchCode || inferBatchCodeFromStudentId(row.studentId);

    const issues: string[] = [];

    if (!normalizedStudentId) issues.push("Student ID is required.");
    if (!row.fullName) issues.push("Full Name is required.");
    if (!row.programCode) issues.push("Program Code is required.");
    if (!inferredBatchCode) {
      issues.push("Batch Code is required or must be inferable from Student ID.");
    }

    if (!row.admissionSemester) {
      issues.push(
        "Admission Semester is empty. This is allowed for now, but should be filled for clean S1 records."
      );
    }

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
        matchedProgramLabel = program.short_name || program.name;
      }
    }

    if (matchedProgramId && inferredBatchCode) {
      const matchedBatch = await findBatch(matchedProgramId, inferredBatchCode);
      matchedBatchId = matchedBatch?.id || null;
      willCreateBatch = !matchedBatchId;
    }

    if (normalizedStudentId) {
      const existingStudent = await findStudentByOfficialId(normalizedStudentId);
      existingStudentId = existingStudent?.id || null;
    }

    if (existingStudentId && matchedProgramId && matchedBatchId) {
      const existingEnrollment = await findEnrollment(
        existingStudentId,
        matchedProgramId,
        matchedBatchId
      );
      existingEnrollmentId = existingEnrollment?.id || null;
    }

    const hasError = issues.some(
      (issue) =>
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

export async function commitStudentImportRows(
  rows: StudentImportPreviewRow[],
  importLogId?: number | null
) {
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
          `Row ${row.rowNumber}: skipped because validation failed. ${row.issues.join(
            " "
          )}`
        );
        continue;
      }

      const student = await upsertStudent(row, importLogId);

      if (student.created) {
        result.createdStudents += 1;
      } else {
        result.updatedStudents += 1;
      }

      const batch = await findOrCreateBatch(
        row.matchedProgramId,
        row.inferredBatchCode,
        row.admissionSemester,
        importLogId
      );

      if (batch.created) {
        result.createdBatches += 1;
      }

      const enrollment = await upsertEnrollment({
        studentDbId: student.id,
        programId: row.matchedProgramId,
        batchId: batch.id,
        admissionSemester: row.admissionSemester,
        status: row.enrollmentStatus || "ACTIVE",
        importLogId,
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
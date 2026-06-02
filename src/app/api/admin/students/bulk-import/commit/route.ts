import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  buildStudentImportPreview,
  commitStudentImportRows,
  parseStudentImportFile,
} from "@/lib/student-bulk-import";
import {
  createStudentImportLog,
  replaceStudentImportErrorRows,
  updateStudentImportLog,
} from "@/lib/student-import-audit";

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  let importLogId: number | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a valid CSV/XLSX student file." },
        { status: 400 }
      );
    }

    const rows = await parseStudentImportFile(file);
    const previewRows = await buildStudentImportPreview(rows);

    const summary = {
      totalRows: previewRows.length,
      okRows: previewRows.filter((row) => row.status === "OK").length,
      warningRows: previewRows.filter((row) => row.status === "WARNING").length,
      errorRows: previewRows.filter((row) => row.status === "ERROR").length,
      existingStudents: previewRows.filter((row) => row.existingStudentId).length,
      newStudents: previewRows.filter(
        (row) => !row.existingStudentId && row.status !== "ERROR"
      ).length,
      batchesToCreate: previewRows.filter(
        (row) => row.willCreateBatch && row.status !== "ERROR"
      ).length,
      existingEnrollments: previewRows.filter((row) => row.existingEnrollmentId)
        .length,
    };

    importLogId = await createStudentImportLog({
      fileName: file.name,
      fileSize: file.size,
      summary,
      status: "STARTED",
      message: "Student bulk import started.",
    });

    const blockingErrors = previewRows.filter((row) => row.status === "ERROR");

    if (blockingErrors.length > 0) {
      await replaceStudentImportErrorRows(
        importLogId,
        blockingErrors.map((row) => ({
          rowNumber: row.rowNumber,
          studentId: row.normalizedStudentId || row.studentId,
          fullName: row.fullName,
          programCode: row.programCode,
          batchCode: row.inferredBatchCode || row.batchCode,
          status: row.status,
          issues: row.issues,
          rawPayload: row,
        }))
      );

      await updateStudentImportLog(importLogId, {
        status: "BLOCKED",
        message:
          "Import blocked because one or more rows contain validation errors.",
        stats: {
          totalRows: previewRows.length,
          createdStudents: 0,
          updatedStudents: 0,
          createdBatches: 0,
          createdEnrollments: 0,
          updatedEnrollments: 0,
          skippedRows: blockingErrors.length,
          errors: blockingErrors.flatMap((row) => row.issues),
        },
      });

      return NextResponse.json(
        {
          error:
            "Import blocked. Fix rows with ERROR status first, then upload again.",
          importLogId,
          errorRows: blockingErrors,
        },
        { status: 400 }
      );
    }

    const result = await commitStudentImportRows(previewRows, importLogId);

    if (result.errors.length > 0) {
      await replaceStudentImportErrorRows(
        importLogId,
        result.errors.map((message, index) => ({
          rowNumber: index + 1,
          studentId: "",
          fullName: "",
          programCode: "",
          batchCode: "",
          status: "COMMIT_ERROR",
          issues: [message],
          rawPayload: { message },
        }))
      );
    }

    await updateStudentImportLog(importLogId, {
      status: result.errors.length > 0 ? "PARTIAL_SUCCESS" : "SUCCESS",
      message:
        result.errors.length > 0
          ? "Import completed with some row-level errors."
          : "Import completed successfully.",
      stats: result,
    });

    return NextResponse.json({
      success: true,
      importLogId,
      result,
    });
  } catch (error) {
    console.error(error);

    if (importLogId) {
      await updateStudentImportLog(importLogId, {
        status: "FAILED",
        message:
          error instanceof Error ? error.message : "Student import failed.",
        stats: {
          totalRows: 0,
          createdStudents: 0,
          updatedStudents: 0,
          createdBatches: 0,
          createdEnrollments: 0,
          updatedEnrollments: 0,
          skippedRows: 0,
          errors: [
            error instanceof Error ? error.message : "Student import failed.",
          ],
        },
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to commit student bulk import.",
      },
      { status: 500 }
    );
  }
}
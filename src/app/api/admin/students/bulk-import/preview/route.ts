import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  buildStudentImportPreview,
  parseStudentImportFile,
} from "@/lib/student-bulk-import";

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

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
      newStudents: previewRows.filter((row) => !row.existingStudentId && row.status !== "ERROR").length,
      batchesToCreate: previewRows.filter((row) => row.willCreateBatch && row.status !== "ERROR").length,
      existingEnrollments: previewRows.filter((row) => row.existingEnrollmentId).length,
    };

    return NextResponse.json({
      success: true,
      summary,
      previewRows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to preview student bulk import.",
      },
      { status: 500 }
    );
  }
}
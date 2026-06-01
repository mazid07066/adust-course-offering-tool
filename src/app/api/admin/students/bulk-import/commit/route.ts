import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  buildStudentImportPreview,
  commitStudentImportRows,
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

    const blockingErrors = previewRows.filter((row) => row.status === "ERROR");

    if (blockingErrors.length > 0) {
      return NextResponse.json(
        {
          error:
            "Import blocked. Fix rows with ERROR status first, then upload again.",
          errorRows: blockingErrors,
        },
        { status: 400 }
      );
    }

    const result = await commitStudentImportRows(previewRows);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error(error);
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
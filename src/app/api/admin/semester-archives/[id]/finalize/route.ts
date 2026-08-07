import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth-guard";
import {
  finalizeSemesterArchive,
  getSemesterArchiveErrorStatus,
} from "@/lib/semester-archive-service";

function parseArchiveId(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Archive id must be a positive integer.");
  }

  return parsed;
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireSuperAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const archiveId = parseArchiveId(id);

    const archive = await finalizeSemesterArchive(
      archiveId,
      guard.id
    );

    return NextResponse.json({
      success: true,
      message: "Semester archive finalized successfully.",
      archive,
    });
  } catch (error) {
    console.error("Semester archive finalize error:", error);

    const serviceStatus = getSemesterArchiveErrorStatus(error);

    const status =
      serviceStatus === 500 &&
      error instanceof Error &&
      error.message.includes("positive integer")
        ? 400
        : serviceStatus;

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize semester archive.",
      },
      {
        status,
      }
    );
  }
}
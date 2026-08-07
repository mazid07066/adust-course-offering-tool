import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  createSemesterArchiveDraft,
  getSemesterArchiveErrorStatus,
  listSemesterArchives,
} from "@/lib/semester-archive-service";

function parseOptionalPositiveInteger(
  value: string | null,
  label: string
): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function parseRequiredPositiveInteger(value: unknown, label: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const academicTermId = parseOptionalPositiveInteger(
      searchParams.get("academicTermId"),
      "academicTermId"
    );

    const programId = parseOptionalPositiveInteger(
      searchParams.get("programId"),
      "programId"
    );

    const status = searchParams.get("status");

    const archives = await listSemesterArchives({
      academicTermId,
      programId,
      status,
    });

    return NextResponse.json({
      success: true,
      count: archives.length,
      archives,
    });
  } catch (error) {
    console.error("Semester archive list error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load semester archives.",
      },
      {
        status: getSemesterArchiveErrorStatus(error),
      }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const academicTermId = parseRequiredPositiveInteger(
      body.academicTermId,
      "academicTermId"
    );

    const programId = parseRequiredPositiveInteger(
      body.programId,
      "programId"
    );

    const archiveNote =
      typeof body.archiveNote === "string"
        ? body.archiveNote.trim() || null
        : null;

    const archive = await createSemesterArchiveDraft({
      academicTermId,
      programId,
      createdByUserId: guard.id,
      archiveNote,
    });

    return NextResponse.json(
      {
        success: true,
        archive,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Semester archive create error:", error);

    const serviceStatus = getSemesterArchiveErrorStatus(error);

    const status =
      serviceStatus === 500 &&
      error instanceof Error &&
      error.message.includes("must be a positive integer")
        ? 400
        : serviceStatus;

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create semester archive.",
      },
      {
        status,
      }
    );
  }
}
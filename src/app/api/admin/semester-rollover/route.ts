import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth-guard";
import {
  getSemesterRolloverErrorStatus,
  getSemesterRolloverPreview,
  prepareSemesterRolloverArchives,
} from "@/lib/semester-rollover-service";

export async function GET(req: NextRequest) {
  const guard = await requireSuperAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const { searchParams } = new URL(req.url);

    const academicTermName = String(
      searchParams.get("academicTermName") || ""
    )
      .trim()
      .toUpperCase();

    if (!academicTermName) {
      return NextResponse.json(
        {
          success: false,
          error: "academicTermName is required.",
        },
        {
          status: 400,
        }
      );
    }

    const preview = await getSemesterRolloverPreview(
      academicTermName
    );

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Semester rollover preview error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load semester rollover preview.",
      },
      {
        status: getSemesterRolloverErrorStatus(error),
      }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const body = await req.json();

    const academicTermName = String(
      body.academicTermName || ""
    )
      .trim()
      .toUpperCase();

    const archiveNote =
      typeof body.archiveNote === "string"
        ? body.archiveNote.trim() || null
        : null;

    if (!academicTermName) {
      return NextResponse.json(
        {
          success: false,
          error: "academicTermName is required.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await prepareSemesterRolloverArchives({
        academicTermName,
        createdByUserId: guard.id,
        archiveNote,
      });

    return NextResponse.json(
      result,
      {
        status: result.createdCount > 0 ? 201 : 200,
      }
    );
  } catch (error) {
    console.error(
      "Semester rollover preparation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare semester rollover archives.",
      },
      {
        status: getSemesterRolloverErrorStatus(error),
      }
    );
  }
}
import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function parseEvidenceId(value: string) {
  const evidenceId = Number(value);

  if (!Number.isInteger(evidenceId) || evidenceId <= 0) {
    throw new Error("Invalid evidence id.");
  }

  return evidenceId;
}

function encodeDownloadFileName(fileName: string) {
  return encodeURIComponent(fileName).replace(/['()]/g, escape);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const evidenceId = parseEvidenceId(id);

    const rows = await prisma.$queryRaw<
      Array<{
        original_file_name: string;
        file_path: string;
        file_mime_type: string | null;
      }>
    >`
      SELECT
        original_file_name,
        file_path,
        file_mime_type
      FROM baete_task_evidence
      WHERE id = ${evidenceId}
      LIMIT 1;
    `;

    const evidence = rows[0];

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence file not found." },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(evidence.file_path);
    const encodedName = encodeDownloadFileName(evidence.original_file_name);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": evidence.file_mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to download evidence file.",
      },
      { status: 500 }
    );
  }
}

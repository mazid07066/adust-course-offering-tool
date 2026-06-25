import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^\w.\-()\s]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function parseTaskId(value: string) {
  const taskId = Number(value);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error("Invalid task id.");
  }

  return taskId;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const taskId = parseTaskId(id);

    const evidence = await prisma.$queryRaw<
      Array<{
        id: number;
        task_id: number;
        original_file_name: string;
        file_mime_type: string | null;
        file_size_bytes: number;
        evidence_note: string | null;
        review_status: string;
        reviewer_feedback: string | null;
        reviewed_at: Date | null;
        created_at: Date;
      }>
    >`
      SELECT
        id,
        task_id,
        original_file_name,
        file_mime_type,
        file_size_bytes,
        evidence_note,
        review_status,
        reviewer_feedback,
        reviewed_at,
        created_at
      FROM baete_task_evidence
      WHERE task_id = ${taskId}
      ORDER BY created_at DESC, id DESC;
    `;

    return NextResponse.json({
      success: true,
      evidence: evidence.map((item) => ({
        ...item,
        download_url: `/api/admin/accreditation/evidence/${item.id}/download`,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load evidence.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const taskId = parseTaskId(id);

    const taskRows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM baete_tasks WHERE id = ${taskId} LIMIT 1;
    `;

    if (!taskRows[0]) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const evidenceNote = String(formData.get("evidenceNote") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Evidence file is required." },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size must be 15 MB or less." },
        { status: 400 }
      );
    }

    const originalFileName = sanitizeFileName(file.name || "evidence-file");
    const extension = path.extname(originalFileName).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        {
          error:
            "Only PDF, Word, PowerPoint, and Excel files are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Upload PDF, Word, PowerPoint, or Excel evidence.",
        },
        { status: 400 }
      );
    }

    const uploadDir = path.join(
      process.cwd(),
      "uploads",
      "baete-evidence",
      String(taskId)
    );

    await mkdir(uploadDir, { recursive: true });

    const storedFileName = `${Date.now()}-${randomUUID()}${extension}`;
    const filePath = path.join(uploadDir, storedFileName);

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, bytes);

    await prisma.$executeRaw`
      INSERT INTO baete_task_evidence (
        task_id,
        original_file_name,
        stored_file_name,
        file_path,
        file_mime_type,
        file_size_bytes,
        evidence_note,
        review_status,
        created_at,
        updated_at
      )
      VALUES (
        ${taskId},
        ${originalFileName},
        ${storedFileName},
        ${filePath},
        ${file.type || null},
        ${file.size},
        ${evidenceNote || null},
        'PENDING_REVIEW',
        NOW(),
        NOW()
      );
    `;

    await prisma.$executeRaw`
      UPDATE baete_tasks
      SET status = CASE
            WHEN status = 'PENDING' THEN 'SUBMITTED'
            ELSE status
          END,
          updated_at = NOW()
      WHERE id = ${taskId};
    `;

    return NextResponse.json({
      success: true,
      message: "Evidence uploaded successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload evidence.",
      },
      { status: 500 }
    );
  }
}

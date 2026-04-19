import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeCode(value: string | null | undefined): string {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[-–—]/g, "");
}

function isValidLevelTerm(value: string | null | undefined): boolean {
  const raw = String(value || "").trim();
  return /^\d+\.\d+$/.test(raw);
}

function inferLevelTermFromCourseCode(courseCode: string | null | undefined): string | null {
  const code = normalizeCode(courseCode);
  const match = code.match(/^[A-Z]{2,8}(\d{4})$/);

  if (!match) return null;

  const digits = match[1];
  const level = Number(digits[0]);
  const term = Number(digits[1]);

  if (!Number.isFinite(level) || !Number.isFinite(term)) return null;
  if (level <= 0 || term <= 0) return null;

  return `${level}.${term}`;
}

export async function GET() {
  try {
    await requireCoordinatorOrAdminApi();

    const rows = await prisma.master_courses.findMany({
      select: {
        id: true,
        course_code: true,
        level_term: true,
      },
      orderBy: [{ id: "asc" }],
    });

    let checked = 0;
    let updated = 0;
    let skipped = 0;
    const samples: Array<{
      id: number;
      courseCode: string;
      oldLevelTerm: string | null;
      newLevelTerm: string;
    }> = [];

    for (const row of rows) {
      checked += 1;

      if (isValidLevelTerm(row.level_term)) {
        skipped += 1;
        continue;
      }

      const inferred = inferLevelTermFromCourseCode(row.course_code);

      if (!inferred) {
        skipped += 1;
        continue;
      }

      await prisma.master_courses.update({
        where: { id: row.id },
        data: {
          level_term: inferred,
        },
      });

      updated += 1;

      if (samples.length < 20) {
        samples.push({
          id: row.id,
          courseCode: row.course_code,
          oldLevelTerm: row.level_term || null,
          newLevelTerm: inferred,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      checked,
      updated,
      skipped,
      samples,
      message: "Master course level_term repair completed.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to repair master course level terms.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
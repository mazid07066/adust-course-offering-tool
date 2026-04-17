import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeCourseCode(raw: string) {
  return raw.replace(/\s+/g, "").trim().toUpperCase();
}

function normalizeTitle(title: string) {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(req.url);

    const programCodesRaw = String(searchParams.get("programCodes") || "")
      .trim()
      .toUpperCase();

    const courseCode = String(searchParams.get("courseCode") || "")
      .trim()
      .toUpperCase();

    const courseTitle = String(searchParams.get("courseTitle") || "").trim();

    if (!programCodesRaw || !courseCode || !courseTitle) {
      return NextResponse.json(
        { error: "programCodes, courseCode, and courseTitle are required." },
        { status: 400 }
      );
    }

    const programCodes = programCodesRaw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const programs = await prisma.programs.findMany({
      where: {
        short_name: {
          in: programCodes,
        },
      },
      include: {
        batches: {
          orderBy: { batch_code: "asc" },
        },
      },
      orderBy: { short_name: "asc" },
    });

    if (!programs.length) {
      return NextResponse.json(
        { error: "No matching programs found." },
        { status: 404 }
      );
    }

    const allBatchIds = programs.flatMap((p) => p.batches.map((b) => b.id));

    const completed = await prisma.batch_completed_courses.findMany({
      where: {
        batch_id: { in: allBatchIds },
      },
    });

    const ongoing = await prisma.batch_current_registrations.findMany({
      where: {
        batch_id: { in: allBatchIds },
      },
    });

    const result = programs.flatMap((program) =>
      program.batches.map((batch) => {
        const completedFound = completed.some(
          (c) =>
            c.batch_id === batch.id &&
            (
              normalizeCourseCode(c.course_code) === normalizeCourseCode(courseCode) ||
              normalizeTitle(c.normalized_title || c.course_title) === normalizeTitle(courseTitle)
            )
        );

        const ongoingFound = ongoing.some(
          (c) =>
            c.batch_id === batch.id &&
            (
              normalizeCourseCode(c.course_code) === normalizeCourseCode(courseCode) ||
              normalizeTitle(c.normalized_title || c.course_title) === normalizeTitle(courseTitle)
            )
        );

        let status: "COMPLETED" | "ONGOING" | "REMAINING" = "REMAINING";

        if (completedFound) {
          status = "COMPLETED";
        } else if (ongoingFound) {
          status = "ONGOING";
        }

        return {
          batch_id: batch.id,
          batch_code: batch.batch_code,
          program_id: program.id,
          program_code: program.short_name,
          program_name: program.name,
          status,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to compute batch eligibility.",
      },
      { status: 500 }
    );
  }
}
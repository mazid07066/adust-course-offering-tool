import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const body = await req.json();

    const offeredCourseId = Number(body.offeredCourseId);
    const manualCourseCode = normalizeText(body.manualCourseCode);
    const targetProgramCodeRaw = String(body.targetProgramCode ?? "").trim();
    const noteRaw = String(body.note ?? "").trim();

    if (!Number.isFinite(offeredCourseId) || offeredCourseId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid offeredCourseId is required." },
        { status: 400 }
      );
    }

    if (!manualCourseCode) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "manualCourseCode is required." },
        { status: 400 }
      );
    }

    const offeredCourse = await prisma.offered_courses.findUnique({
      where: { id: offeredCourseId },
      include: {
        offerings: true,
      },
    });

    if (!offeredCourse) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Offered course not found." },
        { status: 404 }
      );
    }

    if (!["DRAFT", "BUFFER_READY"].includes(String(offeredCourse.offerings.status || ""))) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Manual co-offered codes can only be edited before final publish." },
        { status: 400 }
      );
    }

    const existing = await prisma.offered_course_manual_cooffers.findFirst({
      where: {
        offered_course_id: offeredCourseId,
        manual_course_code: manualCourseCode,
        target_program_code: targetProgramCodeRaw
          ? targetProgramCodeRaw.trim().toUpperCase()
          : null,
      },
      select: { id: true },
    });

    if (existing) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "This manual co-offered code already exists for the selected section." },
        { status: 400 }
      );
    }

    const created = await prisma.offered_course_manual_cooffers.create({
      data: {
        offered_course_id: offeredCourseId,
        manual_course_code: manualCourseCode,
        target_program_code: targetProgramCodeRaw
          ? targetProgramCodeRaw.trim().toUpperCase()
          : null,
        note: noteRaw || null,
      },
    });

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      ok: true,
      message: "Manual co-offered code added successfully.",
      item: created,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add manual co-offered code.";

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
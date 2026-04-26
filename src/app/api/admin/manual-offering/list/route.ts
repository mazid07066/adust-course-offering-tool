import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeUpper(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const termName = normalizeUpper(searchParams.get("termName"));
    const programCode = normalizeUpper(searchParams.get("programCode"));

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const term = await prisma.academic_terms.findFirst({
      where: { name: termName },
      select: { id: true, name: true },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const rows = await prisma.offered_courses.findMany({
      where: {
        notes: "MANUAL_ADDITION",
        offerings: {
          academic_term_id: term.id,
          ...(programCode
            ? {
                programs: {
                  short_name: programCode,
                },
              }
            : {}),
        },
      },
      orderBy: [{ id: "desc" }],
      include: {
        offerings: {
          include: {
            programs: true,
          },
        },
        master_courses: true,
        offered_course_batches: {
          include: {
            batches: true,
          },
        },
        offered_course_slots: {
          include: {
            rooms: true,
          },
          orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
        },
        offered_course_teachers: {
          include: {
            teachers: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        offeredCourseId: row.id,
        offeringId: row.offering_id,
        offeringStatus: row.offerings.status,
        programCode: row.offerings.programs.short_name,
        courseCode: row.master_courses.course_code,
        courseTitle: row.master_courses.course_title,
        section: row.section,
        credit: Number(row.master_courses.credit || 0),
        batchCodes: row.offered_course_batches.map(
          (item) => item.batches.batch_code
        ),
        facultyText:
          row.offered_course_teachers
            .map(
              (item) =>
                `${item.teachers.teacher_code} - ${item.teachers.full_name}`
            )
            .join(", ") || "-",
        scheduleText:
          row.offered_course_slots
            .map(
              (slot) =>
                `${slot.day_of_week} ${slot.start_time}-${slot.end_time} | ${
                  slot.rooms?.room_code || "-"
                }`
            )
            .join(" ; ") || "-",
      })),
    });
  } catch (error) {
    console.error("Manual offering list failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load manual offered courses.",
      },
      { status: 500 }
    );
  }
}
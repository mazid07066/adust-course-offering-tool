import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function POST() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // These deletes are ordered child -> parent to avoid FK issues.
      const facultySelections = await tx.faculty_course_selections.deleteMany({});
      const manualCooffers = await tx.offered_course_manual_cooffers.deleteMany({});
      const offeredTeachers = await tx.offered_course_teachers.deleteMany({});
      const offeredSlots = await tx.offered_course_slots.deleteMany({});
      const offeredBatches = await tx.offered_course_batches.deleteMany({});
      const offeredCourses = await tx.offered_courses.deleteMany({});
      const offerings = await tx.offerings.deleteMany({});

      return {
        facultySelections: facultySelections.count,
        manualCooffers: manualCooffers.count,
        offeredTeachers: offeredTeachers.count,
        offeredSlots: offeredSlots.count,
        offeredBatches: offeredBatches.count,
        offeredCourses: offeredCourses.count,
        offerings: offerings.count,
      };
    });

    return NextResponse.json({
      success: true,
      message:
        "Operational offering data has been cleared. Academic setup, master courses, transcript/registration imports, users, faculties, rooms, and terms were kept.",
      summary: result,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reset operational data.",
      },
      { status: 500 }
    );
  }
}
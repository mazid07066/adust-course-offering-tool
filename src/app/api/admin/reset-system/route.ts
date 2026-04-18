import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function POST() {
  await requireCoordinatorOrAdminApi();

  try {
    await prisma.offered_course_teachers.deleteMany();
    await prisma.offered_course_slots.deleteMany();
    await prisma.offered_course_batches.deleteMany();
    await prisma.offered_courses.deleteMany();
    await prisma.offerings.deleteMany();

    await prisma.batch_current_registrations.deleteMany();
    await prisma.batch_completed_courses.deleteMany();
    await prisma.student_report_logs.deleteMany();

    await prisma.master_courses.deleteMany();
    await prisma.batches.deleteMany();

    await prisma.rooms.deleteMany();
    await prisma.teachers.deleteMany();
    await prisma.academic_terms.deleteMany();

    await prisma.programs.deleteMany();
    await prisma.departments.deleteMany();
    await prisma.academic_catalog_entries.deleteMany();

    return NextResponse.json({
      success: true,
      message:
        "System data has been reset successfully. Users were kept intact. You can now start fresh setup.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "System reset failed.",
      },
      { status: 500 }
    );
  }
}
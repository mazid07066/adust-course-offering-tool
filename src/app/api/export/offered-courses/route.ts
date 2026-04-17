import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(request.url);
    const programCode = String(searchParams.get("programCode") || "").trim().toUpperCase();
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

    if (!programCode || !termName) {
      return NextResponse.json(
        { error: "programCode and termName are required." },
        { status: 400 }
      );
    }

    const program = await prisma.programs.findFirst({
      where: { short_name: programCode },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found." }, { status: 404 });
    }

    const term = await prisma.academic_terms.findFirst({
      where: { name: termName },
    });

    if (!term) {
      return NextResponse.json({ error: "Academic term not found." }, { status: 404 });
    }

    const offerings = await prisma.offerings.findMany({
      where: {
        program_id: program.id,
        academic_term_id: term.id,
        status: "CONFIRMED",
      },
      include: {
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_batches: {
              include: { batches: true },
            },
            offered_course_teachers: {
              include: { teachers: true },
            },
            offered_course_slots: {
              include: { rooms: true },
            },
          },
        },
      },
      orderBy: {
        created_at: "asc",
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Offered Courses");

    sheet.columns = [
      { header: "Program", key: "program", width: 16 },
      { header: "Term", key: "term", width: 16 },
      { header: "Course Code", key: "courseCode", width: 18 },
      { header: "Course Title", key: "courseTitle", width: 40 },
      { header: "Section", key: "section", width: 10 },
      { header: "Credit", key: "credit", width: 10 },
      { header: "Course Type", key: "courseType", width: 14 },
      { header: "Batches", key: "batches", width: 20 },
      { header: "Faculty", key: "faculty", width: 24 },
      { header: "Day", key: "day", width: 14 },
      { header: "Start", key: "start", width: 12 },
      { header: "End", key: "end", width: 12 },
      { header: "Room", key: "room", width: 14 },
    ];

    sheet.getRow(1).font = { bold: true };

    for (const offering of offerings) {
      for (const course of offering.offered_courses) {
        const batches = course.offered_course_batches.map((b) => b.batches.batch_code).join(", ");
        const faculty = course.offered_course_teachers
          .map((t) => t.teachers?.teacher_code || "-")
          .join(", ");

        for (const slot of course.offered_course_slots) {
          sheet.addRow({
            program: program.short_name,
            term: term.name,
            courseCode: course.master_courses.course_code,
            courseTitle: course.master_courses.course_title,
            section: course.section,
            credit: Number(course.master_courses.credit || 0),
            courseType: course.master_courses.course_type,
            batches,
            faculty,
            day: slot.day_of_week,
            start: slot.start_time,
            end: slot.end_time,
            room: slot.rooms?.room_code || "-",
          });
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="offered_courses_${programCode}_${termName.replace(/\s+/g, "_")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export offered courses." },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import ExcelJS from "exceljs";

const dayOrder = ["THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "MONDAY"];

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
    });

    const workbook = new ExcelJS.Workbook();

    for (const day of dayOrder) {
      const sheet = workbook.addWorksheet(day);

      sheet.columns = [
        { header: "Time", key: "time", width: 20 },
        { header: "Course Code", key: "courseCode", width: 18 },
        { header: "Course Title", key: "courseTitle", width: 40 },
        { header: "Section", key: "section", width: 10 },
        { header: "Type", key: "courseType", width: 12 },
        { header: "Faculty", key: "faculty", width: 24 },
        { header: "Batches", key: "batches", width: 20 },
        { header: "Room", key: "room", width: 14 },
      ];

      sheet.getRow(1).font = { bold: true };

      const rows: Array<{
        time: string;
        courseCode: string;
        courseTitle: string;
        section: string;
        courseType: string;
        faculty: string;
        batches: string;
        room: string;
        sortStart: string;
      }> = [];

      for (const offering of offerings) {
        for (const course of offering.offered_courses) {
          const faculty = course.offered_course_teachers
            .map((t) => t.teachers?.teacher_code || "-")
            .join(", ");
          const batches = course.offered_course_batches
            .map((b) => b.batches.batch_code)
            .join(", ");

          for (const slot of course.offered_course_slots) {
            if (String(slot.day_of_week).toUpperCase() !== day) continue;

            rows.push({
              time: `${slot.start_time} - ${slot.end_time}`,
              courseCode: course.master_courses.course_code,
              courseTitle: course.master_courses.course_title,
              section: course.section,
              courseType: course.master_courses.course_type,
              faculty,
              batches,
              room: slot.rooms?.room_code || "-",
              sortStart: slot.start_time,
            });
          }
        }
      }

      rows.sort((a, b) => a.sortStart.localeCompare(b.sortStart));

      for (const row of rows) {
        sheet.addRow(row);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="schedule_${programCode}_${termName.replace(/\s+/g, "_")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export schedule." },
      { status: 500 }
    );
  }
}
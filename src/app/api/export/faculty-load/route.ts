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
            offered_course_teachers: {
              include: { teachers: true },
            },
            offered_course_batches: {
              include: { batches: true },
            },
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet("Faculty Load");

    summarySheet.columns = [
      { header: "Faculty Initial", key: "teacherCode", width: 18 },
      { header: "Faculty Name", key: "fullName", width: 28 },
      { header: "Designation", key: "designation", width: 24 },
      { header: "Total Credits", key: "totalCredits", width: 14 },
      { header: "Theory Credits", key: "theoryCredits", width: 14 },
      { header: "Lab Credits", key: "labCredits", width: 14 },
    ];

    summarySheet.getRow(1).font = { bold: true };

    type FacultyLoad = {
      teacherId: number;
      teacherCode: string;
      fullName: string;
      designation: string | null;
      totalCredits: number;
      theoryCredits: number;
      labCredits: number;
      courses: Array<{
        courseCode: string;
        courseTitle: string;
        section: string;
        credit: number;
        courseType: string;
        batches: string;
      }>;
    };

    const facultyMap = new Map<number, FacultyLoad>();

    for (const offering of offerings) {
      for (const course of offering.offered_courses) {
        const credit = Number(course.master_courses.credit || 0);
        const courseType = String(course.master_courses.course_type || "").toUpperCase();
        const batches = course.offered_course_batches.map((b) => b.batches.batch_code).join(", ");

        for (const assigned of course.offered_course_teachers) {
          const teacher = assigned.teachers;
          if (!teacher) continue;

          if (!facultyMap.has(teacher.id)) {
            facultyMap.set(teacher.id, {
              teacherId: teacher.id,
              teacherCode: teacher.teacher_code,
              fullName: teacher.full_name,
              designation: teacher.designation,
              totalCredits: 0,
              theoryCredits: 0,
              labCredits: 0,
              courses: [],
            });
          }

          const row = facultyMap.get(teacher.id)!;
          row.totalCredits += credit;

          if (courseType === "LAB") {
            row.labCredits += credit;
          } else {
            row.theoryCredits += credit;
          }

          row.courses.push({
            courseCode: course.master_courses.course_code,
            courseTitle: course.master_courses.course_title,
            section: course.section,
            credit,
            courseType,
            batches,
          });
        }
      }
    }

    const facultyRows = Array.from(facultyMap.values()).sort((a, b) =>
      a.teacherCode.localeCompare(b.teacherCode)
    );

    for (const faculty of facultyRows) {
      summarySheet.addRow({
        teacherCode: faculty.teacherCode,
        fullName: faculty.fullName,
        designation: faculty.designation || "-",
        totalCredits: faculty.totalCredits,
        theoryCredits: faculty.theoryCredits,
        labCredits: faculty.labCredits,
      });

      const detailSheet = workbook.addWorksheet(faculty.teacherCode);

      detailSheet.columns = [
        { header: "Course Code", key: "courseCode", width: 18 },
        { header: "Course Title", key: "courseTitle", width: 40 },
        { header: "Section", key: "section", width: 10 },
        { header: "Credit", key: "credit", width: 10 },
        { header: "Type", key: "courseType", width: 12 },
        { header: "Batches", key: "batches", width: 20 },
      ];

      detailSheet.getRow(1).font = { bold: true };

      for (const course of faculty.courses) {
        detailSheet.addRow(course);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="faculty_load_${programCode}_${termName.replace(/\s+/g, "_")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export faculty load." },
      { status: 500 }
    );
  }
}
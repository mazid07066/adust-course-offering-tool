import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = String(searchParams.get("studentId") || "").trim();

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required." },
        { status: 400 }
      );
    }

    const student = await prisma.students.findUnique({
      where: {
        student_id: studentId,
      },
      select: {
        id: true,
        student_id: true,
        full_name: true,
        phone: true,
        email: true,
        current_status: true,
        enrollments: {
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            curriculum_key: true,
            admission_semester: true,
            enrollment_status: true,
            program: {
              select: {
                short_name: true,
                name: true,
              },
            },
            batches: {
              select: {
                batch_code: true,
              },
            },
          },
        },
        advisor_assignments: {
          where: {
            is_active: true,
          },
          take: 1,
          select: {
            teachers: {
              select: {
                teacher_code: true,
                full_name: true,
                designation: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student,
      modules: {
        registration: "Prepared for later ERP phase",
        billing: "Prepared for later ERP phase",
        attendance: "Prepared for later ERP phase",
        grades: "Prepared for later ERP phase",
        admitCard: "Prepared for later ERP phase",
        results: "Prepared for later ERP phase",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student dashboard." },
      { status: 500 }
    );
  }
}
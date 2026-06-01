import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = String(searchParams.get("studentId") || "")
      .trim()
      .toUpperCase();

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
      include: {
        enrollments: {
          include: {
            program: true,
            batches: true,
          },
          orderBy: [{ id: "desc" }],
        },
        advisor_assignments: {
          where: { is_active: true },
          include: {
            teachers: true,
          },
          orderBy: [{ assigned_at: "desc" }],
          take: 1,
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
        registration: "COMING_IN_S2",
        billing: "COMING_IN_S3",
        attendance: "COMING_IN_S4",
        gradeSubmission: "COMING_IN_S5",
        admitCard: "COMING_IN_S6",
        result: "COMING_IN_S7",
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
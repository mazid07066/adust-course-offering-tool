import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseOptionalInt(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseOptionalDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const q = String(searchParams.get("q") || "").trim();
    const status = String(searchParams.get("status") || "").trim();
    const programId = parseOptionalInt(searchParams.get("programId"));
    const batchId = parseOptionalInt(searchParams.get("batchId"));

    const students = await prisma.students.findMany({
      where: {
        current_status: status || undefined,
        OR: q
          ? [
              { student_id: { contains: q, mode: "insensitive" } },
              { full_name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ]
          : undefined,
        enrollments:
          programId || batchId
            ? {
                some: {
                  program_id: programId || undefined,
                  batch_id: batchId || undefined,
                },
              }
            : undefined,
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
      orderBy: [{ created_at: "desc" }],
      take: 200,
    });

    return NextResponse.json({
      success: true,
      students,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load students." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const studentId = cleanString(body.student_id)?.toUpperCase();
    const fullName = cleanString(body.full_name);

    const programId = parseOptionalInt(body.program_id);
    const batchId = parseOptionalInt(body.batch_id);
    const advisorId = parseOptionalInt(body.advisor_teacher_id);

    if (!studentId || !fullName || !programId) {
      return NextResponse.json(
        { error: "student_id, full_name, and program_id are required." },
        { status: 400 }
      );
    }

    const program = await prisma.programs.findUnique({
      where: { id: programId },
      select: {
        id: true,
        short_name: true,
        name: true,
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Selected program was not found." },
        { status: 404 }
      );
    }

    if (batchId) {
      const batch = await prisma.batches.findUnique({
        where: { id: batchId },
        select: { id: true, program_id: true },
      });

      if (!batch) {
        return NextResponse.json(
          { error: "Selected batch was not found." },
          { status: 404 }
        );
      }

      if (batch.program_id !== programId) {
        return NextResponse.json(
          { error: "Selected batch does not belong to the selected program." },
          { status: 400 }
        );
      }
    }

    if (advisorId) {
      const advisor = await prisma.teachers.findUnique({
        where: { id: advisorId },
        select: { id: true, is_active: true },
      });

      if (!advisor || advisor.is_active === false) {
        return NextResponse.json(
          { error: "Selected advisor was not found or is inactive." },
          { status: 404 }
        );
      }
    }

    const curriculumKey = cleanString(body.curriculum_key);

    const created = await prisma.$transaction(async (tx) => {
      const student = await tx.students.create({
        data: {
          student_id: studentId,
          full_name: fullName,
          gender: cleanString(body.gender),
          date_of_birth: parseOptionalDate(body.date_of_birth),
          email: cleanString(body.email),
          phone: cleanString(body.phone),
          guardian_name: cleanString(body.guardian_name),
          guardian_phone: cleanString(body.guardian_phone),
          present_address: cleanString(body.present_address),
          permanent_address: cleanString(body.permanent_address),
          admission_year: parseOptionalInt(body.admission_year),
          admission_term_name: cleanString(body.admission_term_name)?.toUpperCase(),
          current_status: cleanString(body.current_status) || "ACTIVE",
          remarks: cleanString(body.remarks),
        },
      });

      await tx.student_program_enrollments.create({
        data: {
          student_id_ref: student.id,
          program_id: programId,
          batch_id: batchId,
          curriculum_key: curriculumKey,
          enrollment_status: "ACTIVE",
          remarks: "Initial enrollment created from S1 Student Core.",
        },
      });

      await tx.student_status_history.create({
        data: {
          student_id_ref: student.id,
          old_status: null,
          new_status: cleanString(body.current_status) || "ACTIVE",
          note: "Student created.",
        },
      });

      if (advisorId) {
        await tx.student_advisor_assignments.create({
          data: {
            student_id_ref: student.id,
            teacher_id: advisorId,
            is_active: true,
            remarks: "Initial advisor assignment.",
          },
        });
      }

      return student;
    });

    return NextResponse.json({
      success: true,
      student: created,
    });
  } catch (error: any) {
    console.error(error);

    if (String(error?.code) === "P2002") {
      return NextResponse.json(
        { error: "A student with this Student ID already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create student." },
      { status: 500 }
    );
  }
}
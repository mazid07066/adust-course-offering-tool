import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function cleanDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

async function upsertContact(
  tx: any,
  studentIdRef: number,
  contactType: string,
  contactValue: string | null,
  isPrimary = false
) {
  const existing = await tx.student_contacts.findFirst({
    where: {
      student_id_ref: studentIdRef,
      contact_type: contactType,
    },
    select: { id: true },
  });

  if (!contactValue) {
    if (existing) {
      await tx.student_contacts.delete({
        where: { id: existing.id },
      });
    }
    return;
  }

  if (existing) {
    await tx.student_contacts.update({
      where: { id: existing.id },
      data: {
        contact_value: contactValue,
        is_primary: isPrimary,
      },
    });
    return;
  }

  await tx.student_contacts.create({
    data: {
      student_id_ref: studentIdRef,
      contact_type: contactType,
      contact_value: contactValue,
      is_primary: isPrimary,
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const studentDbId = Number(id);

    if (!Number.isFinite(studentDbId)) {
      return NextResponse.json({ error: "Invalid student id." }, { status: 400 });
    }

    const student = await prisma.students.findUnique({
      where: { id: studentDbId },
      include: {
        contacts: {
          orderBy: [{ contact_type: "asc" }, { id: "asc" }],
        },
        status_history: {
          orderBy: [{ changed_at: "desc" }, { id: "desc" }],
          take: 25,
        },
        advisor_assignments: {
          orderBy: [{ assigned_at: "desc" }, { id: "desc" }],
          take: 25,
          include: {
            teachers: true,
          },
        },
        enrollments: {
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          include: {
            program: {
              include: {
                departments: true,
              },
            },
            batches: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const activeAdvisor =
      student.advisor_assignments.find((item) => item.is_active) || null;

    return NextResponse.json({
      success: true,
      student,
      activeAdvisor,
      contacts: student.contacts,
      enrollments: student.enrollments,
      statusHistory: student.status_history,
      advisorAssignments: student.advisor_assignments,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student detail." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const studentDbId = Number(id);

    if (!Number.isFinite(studentDbId)) {
      return NextResponse.json({ error: "Invalid student id." }, { status: 400 });
    }

    const body = await request.json();

    const existing = await prisma.students.findUnique({
      where: { id: studentDbId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.students.update({
        where: { id: studentDbId },
        data: {
          full_name: cleanText(body.full_name) || undefined,
          phone: cleanText(body.phone),
          email: cleanText(body.email),
          gender: cleanText(body.gender),
          date_of_birth: cleanDate(body.date_of_birth),
          guardian_name: cleanText(body.guardian_name),
          guardian_phone: cleanText(body.guardian_phone),
          present_address: cleanText(body.present_address),
          permanent_address: cleanText(body.permanent_address),
          remarks: cleanText(body.remarks),
          blood_group: cleanText(body.blood_group),
          religion: cleanText(body.religion),
          nationality: cleanText(body.nationality),
          emergency_contact_name: cleanText(body.emergency_contact_name),
          emergency_contact_phone: cleanText(body.emergency_contact_phone),
        },
      });

      await upsertContact(tx, studentDbId, "FATHER_NAME", cleanText(body.father_name));
      await upsertContact(tx, studentDbId, "FATHER_PHONE", cleanText(body.father_phone));
      await upsertContact(tx, studentDbId, "FATHER_OCCUPATION", cleanText(body.father_occupation));
      await upsertContact(tx, studentDbId, "MOTHER_NAME", cleanText(body.mother_name));
      await upsertContact(tx, studentDbId, "MOTHER_PHONE", cleanText(body.mother_phone));
      await upsertContact(tx, studentDbId, "MOTHER_OCCUPATION", cleanText(body.mother_occupation));
      await upsertContact(tx, studentDbId, "GUARDIAN_RELATION", cleanText(body.guardian_relation));
      await upsertContact(tx, studentDbId, "GUARDIAN_EMAIL", cleanText(body.guardian_email));
      await upsertContact(tx, studentDbId, "GUARDIAN_ADDRESS", cleanText(body.guardian_address));
    });

    return NextResponse.json({
      success: true,
      message: "Student detail updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update student detail." },
      { status: 500 }
    );
  }
}
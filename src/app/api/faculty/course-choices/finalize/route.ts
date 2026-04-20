import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { cookies } from "next/headers";
import { canFacultyEdit } from "@/lib/faculty-access";

export async function POST(req: NextRequest) {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        { error: "Faculty account is not linked to a faculty record." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("sessionToken")?.value || "";

    const access = await canFacultyEdit(sessionToken);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.message || "Faculty editing is not allowed." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const termName = String(body.termName || "").trim().toUpperCase();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const teacherId = guard.teacher_id;

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

    const existingFinal = await prisma.faculty_course_selections.findFirst({
      where: {
        teacher_id: teacherId,
        academic_term_id: term.id,
        status: "FINAL",
      },
      select: { id: true },
    });

    if (existingFinal) {
      return NextResponse.json(
        { error: "Final submission already completed." },
        { status: 400 }
      );
    }

    const currentBufferSelections = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacherId,
        academic_term_id: term.id,
        status: "BUFFER",
      },
      orderBy: [{ priority_order: "asc" }, { id: "asc" }],
      select: {
        id: true,
      },
    });

    if (currentBufferSelections.length === 0) {
      return NextResponse.json(
        { error: "No buffered choices found to finalize." },
        { status: 400 }
      );
    }

    await prisma.faculty_course_selections.updateMany({
      where: {
        teacher_id: teacherId,
        academic_term_id: term.id,
        status: "BUFFER",
      },
      data: {
        status: "FINAL",
        confirmed_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Final choice submission completed successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to finalize faculty choices." },
      { status: 500 }
    );
  }
}
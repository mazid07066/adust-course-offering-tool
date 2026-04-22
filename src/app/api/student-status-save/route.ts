import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { normalizeComparableTitle } from "@/lib/student-status-parser";
import { resolveCanonicalProgram } from "@/lib/canonical-program";

type SaveCompletedCourse = {
  code: string;
  title: string;
  semester: string;
  credits: number;
  grade: string;
};

type SaveOngoingCourse = {
  code: string;
  title: string;
  credits: number;
  section: string | null;
};

export const runtime = "nodejs";

function normalizeText(value: string) {
  return String(value || "").trim();
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function numbersClose(a: number | null, b: number | null, tolerance = 0.01) {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= tolerance;
}

function dedupeCompletedCourses(courses: SaveCompletedCourse[]) {
  const map = new Map<string, SaveCompletedCourse>();

  for (const course of courses) {
    const code = normalizeUpper(course.code);
    const semester = normalizeUpper(course.semester);
    const key = `${code}||${semester}`;

    map.set(key, {
      code,
      title: normalizeText(course.title),
      semester,
      credits: Number(course.credits),
      grade: normalizeUpper(course.grade || ""),
    });
  }

  return Array.from(map.values());
}

function dedupeOngoingCourses(courses: SaveOngoingCourse[]) {
  const map = new Map<string, SaveOngoingCourse>();

  for (const course of courses) {
    const code = normalizeUpper(course.code);
    const section = normalizeText(course.section || "");
    const key = `${code}||${section}`;

    map.set(key, {
      code,
      title: normalizeText(course.title),
      credits: Number(course.credits),
      section: section || null,
    });
  }

  return Array.from(map.values());
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await request.json();

    const programCode = normalizeUpper(body.programCode || "");
    const batchCode = normalizeText(body.batchCode || "");
    const studentId = normalizeText(body.studentId || "");

    const latestCompletedTerm = body.latestCompletedTerm
      ? normalizeUpper(body.latestCompletedTerm)
      : null;

    const currentRegistrationTerm = body.currentRegistrationTerm
      ? normalizeUpper(body.currentRegistrationTerm)
      : null;

    const transcriptEarnedCredits =
      body.transcriptEarnedCredits === null || body.transcriptEarnedCredits === undefined
        ? null
        : Number(body.transcriptEarnedCredits);

    const parsedCompletedCredits =
      body.parsedCompletedCredits === null || body.parsedCompletedCredits === undefined
        ? null
        : Number(body.parsedCompletedCredits);

    const completedCoursesRaw = Array.isArray(body.completedCourses)
      ? (body.completedCourses as SaveCompletedCourse[])
      : [];

    const ongoingCoursesRaw = Array.isArray(body.ongoingCourses)
      ? (body.ongoingCourses as SaveOngoingCourse[])
      : [];

    const completedCourses = dedupeCompletedCourses(completedCoursesRaw);
    const ongoingCourses = dedupeOngoingCourses(ongoingCoursesRaw);

    if (!programCode) {
      return NextResponse.json({ error: "Program code is required." }, { status: 400 });
    }

    if (!batchCode) {
      return NextResponse.json({ error: "Batch code is required." }, { status: 400 });
    }

    if (
      transcriptEarnedCredits !== null &&
      parsedCompletedCredits !== null &&
      !numbersClose(transcriptEarnedCredits, parsedCompletedCredits)
    ) {
      return NextResponse.json(
        {
          error: `Save blocked because transcript earned credits (${transcriptEarnedCredits}) do not match parsed completed credits (${parsedCompletedCredits}). Please fix the parser result before saving.`,
        },
        { status: 400 }
      );
    }

    const academicIdentity = await prisma.academic_catalog_entries.findFirst({
      where: {
        program_code: programCode,
        is_active: true,
      },
    });

    if (!academicIdentity) {
      return NextResponse.json(
        { error: "Academic identity not found in Academic Setup." },
        { status: 400 }
      );
    }

    const program = await resolveCanonicalProgram({
      department_code: academicIdentity.department_code,
      department_name: academicIdentity.department_name,
      program_code: academicIdentity.program_code,
      program_title: academicIdentity.program_title,
      study_shift: academicIdentity.study_shift,
    });

    const batch = await prisma.batches.upsert({
      where: {
        program_id_batch_code: {
          program_id: program.id,
          batch_code: batchCode,
        },
      },
      update: {
        is_active: true,
      },
      create: {
        program_id: program.id,
        batch_code: batchCode,
        is_active: true,
      },
    });

    let completedTermId: number | null = null;
    if (latestCompletedTerm) {
      const [termType, yearText] = latestCompletedTerm.split(" ");
      const year = Number(yearText);

      const term = await prisma.academic_terms.upsert({
        where: { name: latestCompletedTerm },
        update: {},
        create: {
          name: latestCompletedTerm,
          term_type: termType,
          year,
          is_active: true,
        },
      });

      completedTermId = term.id;
    }

    let registrationTermId: number | null = null;
    if (currentRegistrationTerm) {
      const [termType, yearText] = currentRegistrationTerm.split(" ");
      const year = Number(yearText);

      const term = await prisma.academic_terms.upsert({
        where: { name: currentRegistrationTerm },
        update: {},
        create: {
          name: currentRegistrationTerm,
          term_type: termType,
          year,
          is_active: true,
        },
      });

      registrationTermId = term.id;
    }

    await prisma.batch_completed_courses.deleteMany({
      where: {
        batch_id: batch.id,
      },
    });

    await prisma.batch_current_registrations.deleteMany({
      where: {
        batch_id: batch.id,
      },
    });

    if (completedCourses.length > 0) {
      await prisma.batch_completed_courses.createMany({
        data: completedCourses.map((course) => ({
          batch_id: batch.id,
          academic_term_id: completedTermId,
          course_code: normalizeUpper(course.code),
          course_title: normalizeText(course.title),
          normalized_title: normalizeComparableTitle(course.title),
          credit: Number(course.credits),
          grade: normalizeUpper(course.grade || "") || null,
          source_student_id: studentId || null,
          source_file_name: null,
        })),
      });
    }

    if (ongoingCourses.length > 0 && registrationTermId) {
      await prisma.batch_current_registrations.createMany({
        data: ongoingCourses.map((course) => ({
          batch_id: batch.id,
          academic_term_id: registrationTermId,
          course_code: normalizeUpper(course.code),
          course_title: normalizeText(course.title),
          normalized_title: normalizeComparableTitle(course.title),
          credit: Number(course.credits),
          source_student_id: studentId || null,
          source_file_name: null,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Batch status saved successfully.",
      batchId: batch.id,
      programId: program.id,
      savedCompleted: completedCourses.length,
      savedOngoing: ongoingCourses.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save batch status.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeComparableCourseCode,
  normalizeComparableTitle,
} from "@/lib/student-status-parser";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { resolveCanonicalDepartment } from "@/lib/canonical-program";

export const runtime = "nodejs";

type CatalogProgramRow = {
  id: number;
  department_code: string;
  department_name: string;
  program_code: string;
  program_title: string;
  program_type: string;
  study_shift: string;
  curriculum_version: string;
  curriculum_key: string | null;
  student_id_suffix: string | null;
  display_label: string;
  is_active: boolean;
};

function normalizeText(value: string) {
  return String(value || "").trim();
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function buildCanonicalProgramName(programTitle: string, studyShift: string) {
  return `${normalizeText(programTitle)} [${normalizeUpper(studyShift)}]`;
}

export async function GET(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const { searchParams } = new URL(request.url);
    const programCode = String(searchParams.get("programCode") || "").trim().toUpperCase();
    const batchCode = String(searchParams.get("batchCode") || "").trim();

    if (!programCode) {
      return NextResponse.json(
        { error: "Program code is required." },
        { status: 400 }
      );
    }

    if (!batchCode) {
      return NextResponse.json(
        { error: "Batch code is required." },
        { status: 400 }
      );
    }

    const academicIdentity = (await prisma.academic_catalog_entries.findFirst({
      where: {
        program_code: programCode,
        is_active: true,
      },
    })) as CatalogProgramRow | null;

    if (!academicIdentity) {
      return NextResponse.json(
        { error: "Academic identity not found." },
        { status: 404 }
      );
    }

    const department = await resolveCanonicalDepartment({
      department_code: academicIdentity.department_code,
      department_name: academicIdentity.department_name,
      program_code: academicIdentity.program_code,
      program_title: academicIdentity.program_title,
      study_shift: academicIdentity.study_shift,
    });

    const program = await prisma.programs.findFirst({
      where: {
        department_id: department.id,
        name: buildCanonicalProgramName(
          academicIdentity.program_title,
          academicIdentity.study_shift
        ),
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Program record not found." },
        { status: 404 }
      );
    }

    const batch = await prisma.batches.findFirst({
      where: {
        program_id: program.id,
        batch_code: batchCode,
      },
    });

    let masterCourses = [];

    if (academicIdentity.curriculum_key) {
      masterCourses = await prisma.master_courses.findMany({
        where: {
          curriculum_key: academicIdentity.curriculum_key,
        },
        orderBy: [{ course_code: "asc" }],
      });
    } else {
      masterCourses = await prisma.master_courses.findMany({
        where: {
          program_id: program.id,
        },
        orderBy: [{ course_code: "asc" }],
      });
    }

    if (!batch) {
      return NextResponse.json({
        selectedProgram: {
          programCode: academicIdentity.program_code,
          displayLabel: academicIdentity.display_label,
          curriculumKey: academicIdentity.curriculum_key,
        },
        batchCode,
        counts: {
          completed: 0,
          ongoing: 0,
          remaining: masterCourses.length,
          masterCourses: masterCourses.length,
        },
        completedCourses: [],
        ongoingCourses: [],
        remainingCourses: masterCourses.map((row) => ({
          code: row.course_code,
          title: row.course_title,
          credits: row.credit,
          type: row.course_type,
          group: row.group_name,
          levelTerm: row.level_term,
        })),
        statusRows: masterCourses.map((row) => ({
          code: row.course_code,
          title: row.course_title,
          credits: row.credit,
          type: row.course_type,
          group: row.group_name,
          levelTerm: row.level_term,
          status: "REMAINING",
          color: "amber",
        })),
      });
    }

    const completedRows = await prisma.batch_completed_courses.findMany({
      where: {
        batch_id: batch.id,
      },
      include: {
        academic_terms: true,
      },
      orderBy: [
        { academic_term_id: "asc" },
        { course_code: "asc" },
      ],
    });

    const ongoingRows = await prisma.batch_current_registrations.findMany({
      where: {
        batch_id: batch.id,
      },
      include: {
        academic_terms: true,
      },
      orderBy: [
        { academic_term_id: "asc" },
        { course_code: "asc" },
      ],
    });

    const completedCodeSet = new Set(
      completedRows.map((row) => normalizeComparableCourseCode(row.course_code))
    );
    const completedTitleSet = new Set(
      completedRows.map((row) => normalizeComparableTitle(row.course_title)).filter(Boolean)
    );

    const ongoingCodeSet = new Set(
      ongoingRows.map((row) => normalizeComparableCourseCode(row.course_code))
    );
    const ongoingTitleSet = new Set(
      ongoingRows.map((row) => normalizeComparableTitle(row.course_title)).filter(Boolean)
    );

    const remainingRows = masterCourses.filter((course) => {
      const code = normalizeComparableCourseCode(course.course_code);
      const title = normalizeComparableTitle(course.course_title);

      const isCompleted = completedCodeSet.has(code) || (title && completedTitleSet.has(title));
      const isOngoing = ongoingCodeSet.has(code) || (title && ongoingTitleSet.has(title));

      return !isCompleted && !isOngoing;
    });

    const statusRows = masterCourses.map((course) => {
      const code = normalizeComparableCourseCode(course.course_code);
      const title = normalizeComparableTitle(course.course_title);

      const isCompleted = completedCodeSet.has(code) || (title && completedTitleSet.has(title));
      const isOngoing = ongoingCodeSet.has(code) || (title && ongoingTitleSet.has(title));

      if (isCompleted) {
        return {
          code: course.course_code,
          title: course.course_title,
          credits: course.credit,
          type: course.course_type,
          group: course.group_name,
          levelTerm: course.level_term,
          status: "COMPLETED",
          color: "green",
        };
      }

      if (isOngoing) {
        return {
          code: course.course_code,
          title: course.course_title,
          credits: course.credit,
          type: course.course_type,
          group: course.group_name,
          levelTerm: course.level_term,
          status: "ONGOING",
          color: "blue",
        };
      }

      return {
        code: course.course_code,
        title: course.course_title,
        credits: course.credit,
        type: course.course_type,
        group: course.group_name,
        levelTerm: course.level_term,
        status: "REMAINING",
        color: "amber",
      };
    });

    return NextResponse.json({
      selectedProgram: {
        programCode: academicIdentity.program_code,
        displayLabel: academicIdentity.display_label,
        curriculumKey: academicIdentity.curriculum_key,
      },
      batchCode,
      counts: {
        completed: completedRows.length,
        ongoing: ongoingRows.length,
        remaining: remainingRows.length,
        masterCourses: masterCourses.length,
      },
      completedCourses: completedRows.map((row) => ({
        semester: row.academic_terms?.name || "-",
        code: row.course_code,
        title: row.course_title,
        credits: row.credit,
        grade: row.grade || "-",
      })),
      ongoingCourses: ongoingRows.map((row) => ({
        semester: row.academic_terms?.name || "-",
        code: row.course_code,
        title: row.course_title,
        credits: row.credit,
      })),
      remainingCourses: remainingRows.map((row) => ({
        code: row.course_code,
        title: row.course_title,
        credits: row.credit,
        type: row.course_type,
        group: row.group_name,
        levelTerm: row.level_term,
      })),
      statusRows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load batch status.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  compareTerms,
  extractPdfText,
  getCompletedCourseMap,
  getFailedOnlyCodes,
  getLatestTerm,
  getNextTerm,
  makeDebugTextSample,
  normalizeComparableCourseCode,
  normalizeComparableTitle,
  parseRegistrationCourses,
  parseRegistrationSemester,
  parseStudentIdentity,
  parseTranscriptCourses,
} from "@/lib/student-status-parser";

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

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const formData = await request.formData();

    const selectedProgramCode = String(formData.get("programCode") || "")
      .trim()
      .toUpperCase();

    const transcriptFile = formData.get("transcriptFile") as File | null;
    const registrationFile = formData.get("registrationFile") as File | null;

    if (!selectedProgramCode) {
      return NextResponse.json(
        { error: "Program / curriculum selection is required." },
        { status: 400 }
      );
    }

    if (!transcriptFile && !registrationFile) {
      return NextResponse.json(
        { error: "Upload at least one transcript or registration PDF." },
        { status: 400 }
      );
    }

    const selectedProgram = (await prisma.academic_catalog_entries.findFirst({
      where: {
        program_code: selectedProgramCode,
        is_active: true,
      },
    })) as CatalogProgramRow | null;

    if (!selectedProgram) {
      return NextResponse.json(
        { error: "Selected academic identity was not found in Academic Setup." },
        { status: 400 }
      );
    }

    const transcriptText = transcriptFile
      ? await extractPdfText(Buffer.from(await transcriptFile.arrayBuffer()))
      : "";

    const registrationText = registrationFile
      ? await extractPdfText(Buffer.from(await registrationFile.arrayBuffer()))
      : "";

    const identitySourceText = [transcriptText, registrationText].filter(Boolean).join(" ");
    const identity = parseStudentIdentity(identitySourceText);

    const inferredProgram = identity.suffix
      ? ((await prisma.academic_catalog_entries.findFirst({
          where: {
            student_id_suffix: identity.suffix,
            is_active: true,
          },
        })) as CatalogProgramRow | null)
      : null;

    const transcriptCourses = transcriptText ? parseTranscriptCourses(transcriptText) : [];
    const registrationCourses = registrationText ? parseRegistrationCourses(registrationText) : [];

    const completedMap = getCompletedCourseMap(transcriptCourses);

    const ongoingMap = new Map(
      registrationCourses.map((course) => [
        course.comparableCode,
        {
          code: course.code,
          comparableCode: course.comparableCode,
          comparableTitle: course.comparableTitle,
          title: course.title,
          credits: course.credits,
          section: course.section,
        },
      ])
    );

    const failedOnlyCodes = getFailedOnlyCodes(transcriptCourses);

    const latestCompletedTerm = getLatestTerm(
      Array.from(completedMap.values()).map((row) => row.semester)
    );

    const currentRegistrationTerm = registrationText
      ? parseRegistrationSemester(registrationText)
      : null;

    const suggestedNextOfferingTerm =
      getNextTerm(currentRegistrationTerm || latestCompletedTerm || null);

    let masterCourses = [];

    if (selectedProgram.curriculum_key) {
      masterCourses = await prisma.master_courses.findMany({
        where: {
          curriculum_key: selectedProgram.curriculum_key,
        },
        orderBy: [{ course_code: "asc" }],
      });
    } else {
      const program = await prisma.programs.findFirst({
        where: {
          short_name: selectedProgram.program_code,
        },
      });

      masterCourses = program
        ? await prisma.master_courses.findMany({
            where: {
              program_id: program.id,
            },
            orderBy: [{ course_code: "asc" }],
          })
        : [];
    }

    const completedComparableCodes = new Set(
      Array.from(completedMap.values()).map((row) => row.comparableCode)
    );

    const completedComparableTitles = new Set(
      Array.from(completedMap.values())
        .map((row) => row.comparableTitle)
        .filter(Boolean)
    );

    const ongoingComparableCodes = new Set(
      Array.from(ongoingMap.values()).map((row) => row.comparableCode)
    );

    const ongoingComparableTitles = new Set(
      Array.from(ongoingMap.values())
        .map((row) => row.comparableTitle)
        .filter(Boolean)
    );

    const remainingCourses = masterCourses.filter((course) => {
      const comparableCode = normalizeComparableCourseCode(course.course_code);
      const comparableTitle = normalizeComparableTitle(course.course_title);

      const matchedCompleted =
        completedComparableCodes.has(comparableCode) ||
        (comparableTitle && completedComparableTitles.has(comparableTitle));

      const matchedOngoing =
        ongoingComparableCodes.has(comparableCode) ||
        (comparableTitle && ongoingComparableTitles.has(comparableTitle));

      return !matchedCompleted && !matchedOngoing;
    });

    const warningMessages: string[] = [];

    if (
      identity.studentId &&
      inferredProgram &&
      inferredProgram.program_code !== selectedProgram.program_code
    ) {
      warningMessages.push(
        `Selected academic identity (${selectedProgram.program_code}) does not match the student ID suffix inference (${inferredProgram.program_code}).`
      );
    }

    if (!identity.studentId) {
      warningMessages.push("Student ID could not be detected from the uploaded PDF text.");
    }

    if (!masterCourses.length) {
      warningMessages.push(
        selectedProgram.curriculum_key
          ? `No master course list was found yet for curriculum key ${selectedProgram.curriculum_key}.`
          : `No master course list was found yet for ${selectedProgram.program_code}.`
      );
    }

    if (!currentRegistrationTerm && !latestCompletedTerm) {
      warningMessages.push(
        "Neither current registration term nor latest completed term could be determined."
      );
    }

    return NextResponse.json({
      success: true,
      selectedProgram: {
        programCode: selectedProgram.program_code,
        displayLabel: selectedProgram.display_label,
        curriculumKey: selectedProgram.curriculum_key,
      },
      inferredProgram: inferredProgram
        ? {
            programCode: inferredProgram.program_code,
            displayLabel: inferredProgram.display_label,
            curriculumKey: inferredProgram.curriculum_key,
          }
        : null,
      studentIdentity: identity,
      warningMessages,
      transcriptSummary: {
        parsedCount: transcriptCourses.length,
        latestCompletedTerm,
        failedOnlyCodes,
      },
      registrationSummary: {
        parsedCount: registrationCourses.length,
        currentRegistrationTerm,
      },
      offeringContext: {
        suggestedNextOfferingTerm,
      },
      counts: {
        completed: completedMap.size,
        ongoing: ongoingMap.size,
        remaining: remainingCourses.length,
        masterCourses: masterCourses.length,
      },
      completedCourses: Array.from(completedMap.values()).sort((a, b) => {
        const termCompare = compareTerms(a.semester, b.semester);
        if (termCompare !== 0) return termCompare;
        return a.code.localeCompare(b.code);
      }),
      ongoingCourses: Array.from(ongoingMap.values()).sort((a, b) =>
        a.code.localeCompare(b.code)
      ),
      remainingCourses: remainingCourses.map((course) => ({
        code: course.course_code,
        title: course.course_title,
        credits: course.credit,
        type: course.course_type,
        group: course.group_name,
        levelTerm: course.level_term,
        curriculumKey: course.curriculum_key,
      })),
      debug: {
        transcriptTextSample: makeDebugTextSample(transcriptText),
        registrationTextSample: makeDebugTextSample(registrationText),
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Transcript and registration parsing failed.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { ImportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeTitle(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function selectApplicableCatalog(
  catalogs: {
    id: string;
    title: string;
    startingBatchCode: string;
    courses: {
      id: string;
      code: string;
      title: string;
      creditHours: number;
      semesterNo: number | null;
    }[];
  }[],
  batchCode: string
) {
  const batchNumber = Number(batchCode);

  const eligible = catalogs
    .filter((catalog) => Number(catalog.startingBatchCode) <= batchNumber)
    .sort((a, b) => Number(b.startingBatchCode) - Number(a.startingBatchCode));

  if (eligible.length > 0) return eligible[0];

  const fallback = [...catalogs].sort(
    (a, b) => Number(a.startingBatchCode) - Number(b.startingBatchCode)
  );

  return fallback[0] ?? null;
}

async function deletePreviousSameTitleImports(
  batchId: string,
  type: ImportType,
  originalName: string
) {
  const oldImports = await prisma.importFile.findMany({
    where: {
      batchId,
      type,
      originalName,
    },
    select: {
      id: true,
    },
  });

  const oldIds = oldImports.map((item) => item.id);

  if (oldIds.length > 0) {
    await prisma.parsedBatchCourse.deleteMany({
      where: {
        importFileId: {
          in: oldIds,
        },
      },
    });

    await prisma.importFile.deleteMany({
      where: {
        id: {
          in: oldIds,
        },
      },
    });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const formData = await request.formData();

    const transcriptFile = formData.get("transcriptFile") as File | null;
    const registrationFile = formData.get("registrationFile") as File | null;
    const season = String(formData.get("offeringSeason") || "");
    const year = String(formData.get("offeringYear") || "");
    const programCode = String(formData.get("programCode") || "").trim().toUpperCase();

    if (!transcriptFile || !registrationFile || !programCode) {
      return NextResponse.json(
        { error: "Program code, transcript file, and registration file are required." },
        { status: 400 }
      );
    }

    const {
      buildOfferingSemesterTitle,
      parseRegistrationPdf,
      parseTranscriptPdf,
    } = await import("@/lib/pdf-import");

    const offeringSemesterTitle = buildOfferingSemesterTitle(season, year);
    const semesterCode = offeringSemesterTitle.replace(/\s+/g, "-");

    const transcriptBuffer = Buffer.from(await transcriptFile.arrayBuffer());
    const registrationBuffer = Buffer.from(await registrationFile.arrayBuffer());

    const transcriptResult = await parseTranscriptPdf(transcriptBuffer);
    const registrationResult = await parseRegistrationPdf(registrationBuffer);

    const detectedBatchCode = transcriptResult.batchCode || registrationResult.batchCode;

    if (!detectedBatchCode) {
      return NextResponse.json(
        { error: "Could not detect batch from student ID." },
        { status: 400 }
      );
    }

    const program = await prisma.program.findUnique({
      where: {
        code: programCode,
      },
      include: {
        courseCatalogs: {
          include: {
            courses: true,
          },
        },
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: `Program ${programCode} was not found.` },
        { status: 404 }
      );
    }

    const applicableCatalog = selectApplicableCatalog(program.courseCatalogs, detectedBatchCode);

    if (!applicableCatalog) {
      return NextResponse.json(
        { error: `No course catalog found for program ${programCode}.` },
        { status: 404 }
      );
    }

    const batch = await prisma.batch.upsert({
      where: {
        programId_code: {
          programId: program.id,
          code: detectedBatchCode,
        },
      },
      update: {},
      create: {
        programId: program.id,
        code: detectedBatchCode,
        displayName: `Batch ${detectedBatchCode}`,
        admissionSemester: "Unknown",
        expectedGradYear: null,
        isActive: true,
      },
    });

    const semester = await prisma.semester.upsert({
      where: {
        code: semesterCode,
      },
      update: {
        title: offeringSemesterTitle,
      },
      create: {
        code: semesterCode,
        title: offeringSemesterTitle,
        isActive: true,
      },
    });

    await deletePreviousSameTitleImports(batch.id, ImportType.TRANSCRIPT, transcriptFile.name);
    await deletePreviousSameTitleImports(batch.id, ImportType.REGISTRATION, registrationFile.name);

    const transcriptImport = await prisma.importFile.create({
      data: {
        batchId: batch.id,
        type: ImportType.TRANSCRIPT,
        semesterId: semester.id,
        originalName: transcriptFile.name,
        studentId: transcriptResult.studentId,
        studentName: transcriptResult.studentName,
      },
    });

    const registrationImport = await prisma.importFile.create({
      data: {
        batchId: batch.id,
        type: ImportType.REGISTRATION,
        semesterId: semester.id,
        originalName: registrationFile.name,
        studentId: registrationResult.studentId,
        studentName: registrationResult.studentName,
      },
    });

    const codeMap = new Map(
      applicableCatalog.courses.map((course) => [course.code.toUpperCase(), course])
    );

    const titleMap = new Map(
      applicableCatalog.courses.map((course) => [normalizeTitle(course.title), course])
    );

    function mapCourse(rawCode: string, rawTitle: string) {
      const byCode = codeMap.get(rawCode.toUpperCase());
      if (byCode) return byCode;

      const byTitle = titleMap.get(normalizeTitle(rawTitle));
      if (byTitle) return byTitle;

      return null;
    }

    for (const course of transcriptResult.courses) {
      const mappedCourse = mapCourse(course.rawCourseCode, course.rawCourseTitle);

      await prisma.parsedBatchCourse.create({
        data: {
          batchId: batch.id,
          importFileId: transcriptImport.id,
          courseId: mappedCourse?.id ?? null,
          rawCourseCode: course.rawCourseCode,
          rawCourseTitle: course.rawCourseTitle,
          creditHours: course.creditHours,
          grade: course.grade,
          sourceSemester: course.sourceSemester,
          isCompleted: course.isCompleted,
          isOngoing: false,
          isPassed: course.isPassed,
        },
      });
    }

    for (const course of registrationResult.courses) {
      const mappedCourse = mapCourse(course.rawCourseCode, course.rawCourseTitle);

      await prisma.parsedBatchCourse.create({
        data: {
          batchId: batch.id,
          importFileId: registrationImport.id,
          courseId: mappedCourse?.id ?? null,
          rawCourseCode: course.rawCourseCode,
          rawCourseTitle: course.rawCourseTitle,
          creditHours: course.creditHours,
          grade: null,
          sourceSemester: course.sourceSemester,
          isCompleted: false,
          isOngoing: true,
          isPassed: null,
          section: course.section,
          rawScheduleText: course.rawScheduleText,
        },
      });
    }

    const completedCourses = transcriptResult.courses.filter((course) => course.isCompleted);
    const ongoingCourses = registrationResult.courses;

    const completedKeys = new Set(
      completedCourses.map((course) => normalizeTitle(course.rawCourseTitle))
    );

    const ongoingKeys = new Set(
      ongoingCourses.map((course) => normalizeTitle(course.rawCourseTitle))
    );

    const remainingCourses = applicableCatalog.courses.filter((course) => {
      const key = normalizeTitle(course.title);
      return !completedKeys.has(key) && !ongoingKeys.has(key);
    });

    return NextResponse.json({
      success: true,
      debug: {
        transcriptExtractedCount: transcriptResult.courses.length,
        completedCount: completedCourses.length,
        ongoingCount: ongoingCourses.length,
        transcriptPreview: transcriptResult.debugTranscriptText ?? "",
      },
      program: {
        code: program.code,
        name: program.name,
      },
      batch: {
        id: batch.id,
        code: batch.code,
        displayName: batch.displayName,
      },
      catalog: {
        id: applicableCatalog.id,
        title: applicableCatalog.title,
        startingBatchCode: applicableCatalog.startingBatchCode,
      },
      studentId: transcriptResult.studentId || registrationResult.studentId,
      studentName: transcriptResult.studentName || registrationResult.studentName,
      detectedBatchCode,
      lastCompletedSemester: transcriptResult.lastCompletedSemester,
      currentSemester: registrationResult.currentSemester,
      offeringSemester: offeringSemesterTitle,
      completedCourses,
      ongoingCourses,
      remainingCourses,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    await prisma.parsedBatchCourse.deleteMany({});
    await prisma.importFile.deleteMany({});

    return NextResponse.json({
      success: true,
      message: "All previous transcript and registration uploads have been deleted.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Reset failed.",
      },
      { status: 500 }
    );
  }
}
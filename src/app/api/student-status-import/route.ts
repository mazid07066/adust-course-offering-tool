import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import PDFParser from "pdf2json";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import {
  inferProgramFromStudentId,
  matchSelectedProgramToInference,
} from "@/lib/student-id-profile";

type PdfParseResult = {
  text?: string;
};

function safeDecodePdfText(value: string) {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    try {
      return decodeURIComponent(value.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
    } catch {
      return value;
    }
  }
}

async function extractPdfTextWithPdfParse(buffer: Buffer): Promise<string> {
  const result = (await pdfParse(buffer)) as PdfParseResult;
  return String(result?.text || "");
}

async function extractPdfTextWithPdf2Json(buffer: Buffer): Promise<string> {
  return await new Promise((resolve, reject) => {
    const parser = new PDFParser();

    parser.on("pdfParser_dataError", (errData: any) => {
      reject(new Error(errData?.parserError || "pdf2json failed"));
    });

    parser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        const pages = pdfData?.Pages || [];
        const texts: string[] = [];

        for (const page of pages) {
          const pageTexts = page?.Texts || [];

          for (const item of pageTexts) {
            const runs = item?.R || [];

            for (const run of runs) {
              const raw = safeDecodePdfText(String(run?.T || ""));
              if (raw) texts.push(raw);
            }

            texts.push("\n");
          }

          texts.push("\n\n");
        }

        resolve(texts.join(" "));
      } catch (error) {
        reject(error);
      }
    });

    parser.parseBuffer(buffer);
  });
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    return await extractPdfTextWithPdfParse(buffer);
  } catch (error) {
    console.warn("pdf-parse failed, trying pdf2json fallback:", error);
    return await extractPdfTextWithPdf2Json(buffer);
  }
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeCourseCode(text: string) {
  return String(text || "").replace(/\s+/g, "").trim().toUpperCase();
}

function extractStudentId(text: string) {
  const match = text.match(/\b(\d{2,3}-\d{3,4}-\d{3})\b/);
  return match ? match[1] : null;
}

function extractBatchCode(text: string) {
  const studentId = extractStudentId(text);
  if (studentId) {
    return studentId.split("-")[0];
  }

  const batchMatch = text.match(/\bBatch\s*[:\-]?\s*(\d{2,3})\b/i);
  return batchMatch ? batchMatch[1] : null;
}

function normalizeSemesterLabel(season: string, year: string | number) {
  return `${String(season).toUpperCase()} ${String(year)}`;
}

function compareSemester(a: string, b: string) {
  const seasonOrder: Record<string, number> = {
    SPRING: 1,
    SUMMER: 2,
    FALL: 3,
  };

  const ma = a.toUpperCase().match(/^(SPRING|SUMMER|FALL)\s+(\d{4})$/);
  const mb = b.toUpperCase().match(/^(SPRING|SUMMER|FALL)\s+(\d{4})$/);

  if (!ma || !mb) return 0;

  const yearA = Number(ma[2]);
  const yearB = Number(mb[2]);

  if (yearA !== yearB) return yearA - yearB;
  return seasonOrder[ma[1]] - seasonOrder[mb[1]];
}

function extractSemesterTokens(text: string) {
  const normalized = text.toUpperCase();

  const matches = Array.from(
    normalized.matchAll(/\b(SPRING|SUMMER|FALL)\s*,?\s*(\d{4})\b/g)
  );

  return matches.map((m) => ({
    season: m[1],
    year: Number(m[2]),
    label: normalizeSemesterLabel(m[1], m[2]),
  }));
}

function getLatestSemester(text: string) {
  const semesters = extractSemesterTokens(text);
  if (!semesters.length) return null;

  semesters.sort((a, b) => compareSemester(a.label, b.label));
  return semesters[semesters.length - 1].label;
}

function extractRegistrationSemester(text: string) {
  const normalized = text.toUpperCase();

  const strongPatterns = [
    /COURSE\s+REGISTRATION\s+BILLING\s+STATEMENT\s*\/\s*REGISTRATION\s+(SPRING|SUMMER|FALL)\s*,?\s*(\d{4})/i,
    /\bREGISTRATION\s+(SPRING|SUMMER|FALL)\s*,?\s*(\d{4})\b/i,
    /\bSEMESTER\s*[:\-]?\s*(SPRING|SUMMER|FALL)\s*,?\s*(\d{4})\b/i,
  ];

  for (const pattern of strongPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      return normalizeSemesterLabel(match[1], match[2]);
    }
  }

  return getLatestSemester(text);
}

function getPreviousSemester(term: string | null) {
  if (!term) return null;

  const match = term.toUpperCase().match(/^(SPRING|SUMMER|FALL)\s+(\d{4})$/);
  if (!match) return null;

  const season = match[1];
  const year = Number(match[2]);

  if (season === "SPRING") return `FALL ${year - 1}`;
  if (season === "SUMMER") return `SPRING ${year}`;
  return `SUMMER ${year}`;
}

function extractLatestCompletedSemesterFromTranscript(rawTranscriptText: string) {
  const semesters = extractSemesterTokens(rawTranscriptText);
  if (!semesters.length) return null;

  semesters.sort((a, b) => compareSemester(a.label, b.label));
  return semesters[semesters.length - 1].label;
}

function detectGradeNearLine(line: string) {
  const gradeMatch = line.match(/\b(A\+|A|A-|B\+|B|B-|C\+|C|D|F)\b/);
  return gradeMatch ? gradeMatch[1] : null;
}

function parseTranscriptMatches(
  transcriptText: string,
  masterCourses: Array<{
    course_code: string;
    course_title: string;
    normalized_title: string;
    credit: number;
  }>
) {
  const lines = transcriptText
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const found: Array<{
    course_code: string;
    course_title: string;
    normalized_title: string;
    credit: number;
    grade: string | null;
    completed: boolean;
  }> = [];

  for (const course of masterCourses) {
    const code = normalizeCourseCode(course.course_code);

    let matchedLine = "";
    let grade: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const current = lines[i];
      const combined = `${current} ${lines[i + 1] || ""}`;

      if (
        current.toUpperCase().includes(code) ||
        combined.toUpperCase().includes(code)
      ) {
        matchedLine = combined;
        grade = detectGradeNearLine(combined);
        break;
      }
    }

    if (matchedLine) {
      found.push({
        course_code: course.course_code,
        course_title: course.course_title,
        normalized_title: course.normalized_title || course.course_title,
        credit: Number(course.credit || 0),
        grade,
        completed: grade !== "F",
      });
    }
  }

  return found;
}

function parseRegistrationMatches(
  registrationText: string,
  masterCourses: Array<{
    course_code: string;
    course_title: string;
    normalized_title: string;
    credit: number;
  }>
) {
  const upperText = registrationText.toUpperCase();

  const found: Array<{
    course_code: string;
    course_title: string;
    normalized_title: string;
    credit: number;
  }> = [];

  for (const course of masterCourses) {
    const code = normalizeCourseCode(course.course_code);

    if (upperText.includes(code)) {
      found.push({
        course_code: course.course_code,
        course_title: course.course_title,
        normalized_title: course.normalized_title || course.course_title,
        credit: Number(course.credit || 0),
      });
    }
  }

  return found;
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const formData = await request.formData();

    const programCode = String(formData.get("programCode") || "")
      .trim()
      .toUpperCase();

    const replaceExisting =
      String(formData.get("replaceExisting") || "false") === "true";

    const transcriptPdf = formData.get("transcriptPdf") as File | null;
    const registrationPdf = formData.get("registrationPdf") as File | null;

    if (!programCode) {
      return NextResponse.json(
        { error: "Program is required." },
        { status: 400 }
      );
    }

    if (!registrationPdf) {
      return NextResponse.json(
        { error: "Registration PDF is required." },
        { status: 400 }
      );
    }

    const program = await prisma.programs.findFirst({
      where: {
        short_name: programCode,
      },
      include: {
        departments: true,
        master_courses: {
          where: {
            is_active: true,
          },
          orderBy: {
            course_code: "asc",
          },
        },
      },
    });

    if (!program) {
      return NextResponse.json(
        { error: "Selected program was not found." },
        { status: 404 }
      );
    }

    if (!program.master_courses.length) {
      return NextResponse.json(
        { error: "No master course list exists for the selected program." },
        { status: 400 }
      );
    }

    const registrationBuffer = Buffer.from(await registrationPdf.arrayBuffer());
    const registrationTextRaw = await extractPdfText(registrationBuffer);

    let transcriptTextRaw = "";
    if (transcriptPdf) {
      const transcriptBuffer = Buffer.from(await transcriptPdf.arrayBuffer());
      transcriptTextRaw = await extractPdfText(transcriptBuffer);
    }

    const detectedStudentId =
      extractStudentId(registrationTextRaw) ||
      extractStudentId(transcriptTextRaw) ||
      null;

    const batchCode =
      extractBatchCode(registrationTextRaw) ||
      extractBatchCode(transcriptTextRaw) ||
      null;

    if (!batchCode) {
      return NextResponse.json(
        { error: "Could not detect batch code from uploaded PDF files." },
        { status: 400 }
      );
    }

    const registrationSemester = extractRegistrationSemester(registrationTextRaw);
    if (!registrationSemester) {
      return NextResponse.json(
        {
          error:
            "Could not detect current registration semester from registration PDF.",
        },
        { status: 400 }
      );
    }

    const transcriptMatches = transcriptTextRaw
      ? parseTranscriptMatches(transcriptTextRaw, program.master_courses)
      : [];

    let latestCompletedSemester = transcriptTextRaw
      ? extractLatestCompletedSemesterFromTranscript(transcriptTextRaw)
      : null;

    if (!latestCompletedSemester && transcriptMatches.length > 0) {
      latestCompletedSemester = getPreviousSemester(registrationSemester);
    }

    const registrationMatches = parseRegistrationMatches(
      registrationTextRaw,
      program.master_courses
    );

    if (!registrationMatches.length) {
      return NextResponse.json(
        {
          error:
            "No registration course rows could be matched from the uploaded PDF.",
        },
        { status: 400 }
      );
    }

    const inferred = inferProgramFromStudentId(detectedStudentId);
    const selectedMatchesInference = matchSelectedProgramToInference(
      program.short_name,
      inferred.inferredProgramCode,
      inferred.inferredVariant
    );

    const inferenceWarning =
      detectedStudentId &&
      inferred.inferredProgramCode &&
      !selectedMatchesInference
        ? `Selected program ${program.short_name} does not match student-id inference (${inferred.inferredProgramCode}${inferred.inferredVariant ? `-${inferred.inferredVariant}` : ""}). Import was still allowed because migrated/external exceptions can exist.`
        : null;

    let batch = await prisma.batches.findFirst({
      where: {
        program_id: program.id,
        batch_code: batchCode,
      },
    });

    const alreadyExisted = !!batch;

    if (!batch) {
      batch = await prisma.batches.create({
        data: {
          program_id: program.id,
          batch_code: batchCode,
          admission_term: registrationSemester,
          is_active: true,
        },
      });
    }

    let academicTerm = await prisma.academic_terms.findFirst({
      where: {
        name: registrationSemester,
      },
    });

    if (!academicTerm) {
      const match = registrationSemester.match(
        /^(SPRING|SUMMER|FALL)\s+(\d{4})$/i
      );
      if (!match) {
        return NextResponse.json(
          { error: "Invalid registration semester format." },
          { status: 400 }
        );
      }

      academicTerm = await prisma.academic_terms.create({
        data: {
          name: registrationSemester.toUpperCase(),
          year: Number(match[2]),
          term_type: match[1].toUpperCase(),
          is_active: true,
        },
      });
    }

    if (replaceExisting) {
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
    }

    let completedImported = 0;
    for (const row of transcriptMatches) {
      if (!row.completed) continue;

      await prisma.batch_completed_courses.create({
        data: {
          batch_id: batch.id,
          academic_term_id: null,
          course_code: row.course_code,
          course_title: row.course_title,
          normalized_title: row.normalized_title,
          credit: row.credit,
          grade: row.grade,
          source_student_id: detectedStudentId,
          source_file_name: transcriptPdf?.name || null,
        },
      });

      completedImported += 1;
    }

    let ongoingImported = 0;
    for (const row of registrationMatches) {
      await prisma.batch_current_registrations.create({
        data: {
          batch_id: batch.id,
          academic_term_id: academicTerm.id,
          course_code: row.course_code,
          course_title: row.course_title,
          normalized_title: row.normalized_title,
          credit: row.credit,
          source_student_id: detectedStudentId,
          source_file_name: registrationPdf.name,
        },
      });

      ongoingImported += 1;
    }

    await prisma.student_report_logs.create({
      data: {
        student_id: detectedStudentId || `${program.short_name}-${batch.batch_code}`,
        student_name: `${program.short_name} Batch ${batch.batch_code}`,
        uploaded_by_user_id: 1,
        transcript_filename: transcriptPdf?.name || null,
        registration_filename: registrationPdf.name,
        latest_completed_semester: latestCompletedSemester,
        registration_semester: registrationSemester,
        total_earned_credits: null,
        gpa: null,
        generated_excel_path: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Student status imported successfully.",
      batchCode: batch.batch_code,
      detectedStudentId,
      registrationSemester,
      latestCompletedSemester,
      transcriptRowsParsed: transcriptMatches.length,
      registrationRowsParsed: registrationMatches.length,
      transcriptRowsMatched: transcriptMatches.length,
      registrationRowsMatched: registrationMatches.length,
      completedImported,
      ongoingImported,
      inferredProgram: inferred,
      inferenceWarning,
      importTarget: {
        departmentCode: program.departments?.short_name || null,
        departmentName: program.departments?.name || null,
        programCode: program.short_name,
        programName: program.name,
        batchId: batch.id,
        batchCode: batch.batch_code,
        alreadyExisted,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import student status.",
      },
      { status: 500 }
    );
  }
}
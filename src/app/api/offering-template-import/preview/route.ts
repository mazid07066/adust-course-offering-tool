import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { parseOfferingTemplateWorkbook } from "@/lib/offering-template-parser";
import {
  isBlankLikeFaculty,
  isSlotOptionalCourseType,
  normalizeCourseCode,
  normalizeCourseTitle,
  normalizeTeacherCode,
  parseOneCourseCodeAliases,
} from "@/lib/offering-template-normalize";
import { resolveCanonicalProgram } from "@/lib/canonical-program";

export const runtime = "nodejs";

type PreviewRowStatus = "READY" | "WARNING" | "BLOCKED";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
};

type ParsedSlot = {
  day: string;
  rawTime: string;
  startTime: string;
  endTime: string;
  timeParseOk: boolean;
  timeParseReason: string;
};

type PreviewRow = {
  rowKey: string;
  batchCode: string;
  courseTitle: string;
  courseCode: string;
  coofferedCourseCode: string;
  facultyInitial: string;
  section: string;
  credits: number;
  day: string;
  rawTime: string;
  startTime: string;
  endTime: string;
  timeParseOk: boolean;
  room: string;
  courseType: string;
  parsedSlots: ParsedSlot[];
  status: PreviewRowStatus;
  issues: string[];
  resolvedCourseId: number | null;
  resolvedCourseTitle: string | null;
  resolvedCourseCode: string | null;
  resolvedCourseMatchedBy: string | null;
  resolvedCourseMatchedValue: string | null;
  resolvedBatchId: number | null;
  resolvedBatchProgramCode: string | null;
  resolvedTeacherId: number | null;
  resolvedTeacherCode: string | null;
  resolvedRoomId: number | null;
  resolvedRoomCode: string | null;
  slotOptional: boolean;
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueById<T extends { id: number }>(rows: T[]) {
  const seen = new Set<number>();
  const out: T[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

function normalizeUpper(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D+/g, "").trim();
}

function safeRoomNumber(room: any) {
  const raw = room?.room_number;
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toUpperCase();
}

function resolveRoom(inputRoom: string, rooms: any[]) {
  const raw = String(inputRoom || "").trim();
  if (!raw) return null;

  const normalizedInput = normalizeUpper(raw);
  const inputDigits = digitsOnly(raw);

  for (const room of rooms) {
    const roomCode = normalizeUpper(room.room_code);
    const roomNumber = safeRoomNumber(room);
    const roomCodeDigits = digitsOnly(room.room_code);
    const roomNumberDigits = digitsOnly(room.room_number);

    if (
      normalizedInput === roomCode ||
      normalizedInput === roomNumber ||
      (inputDigits && inputDigits === roomCodeDigits) ||
      (inputDigits && inputDigits === roomNumberDigits)
    ) {
      return room;
    }
  }

  for (const room of rooms) {
    const roomCode = normalizeUpper(room.room_code);
    const roomNumber = safeRoomNumber(room);
    const roomType = normalizeUpper(room.room_type);
    const building = normalizeUpper(room.building);

    const candidates = [
      roomCode,
      roomNumber,
      `${roomCode}-${roomNumber}`,
      `${roomType}-${roomNumber}`,
      `${building}-${roomNumber}`,
      `${roomType} (${roomNumber})`,
      `${roomCode} (${roomNumber})`,
    ].filter(Boolean);

    if (candidates.includes(normalizedInput)) {
      return room;
    }
  }

  return null;
}

function resolveTeacher(inputTeacherCode: string, teachers: any[]) {
  const normalized = normalizeTeacherCode(inputTeacherCode);
  if (!normalized) return null;

  return (
    teachers.find(
      (teacher) => normalizeTeacherCode(teacher.teacher_code) === normalized
    ) || null
  );
}

function resolveBatch(inputBatchCode: string, batches: any[]) {
  const normalized = normalizeUpper(inputBatchCode);
  if (!normalized) return null;

  return (
    batches.find((batch) => normalizeUpper(batch.batch_code) === normalized) || null
  );
}

function resolveCourseByCodeOrTitle(
  row: {
    courseCode: string;
    coofferedCourseCode: string;
    courseTitle: string;
  },
  masterCourses: any[]
) {
  const directCodes = uniqueStrings([
    normalizeCourseCode(row.courseCode),
    normalizeCourseCode(row.coofferedCourseCode),
    ...parseOneCourseCodeAliases(row.courseCode),
    ...parseOneCourseCodeAliases(row.coofferedCourseCode),
  ]);

  for (const code of directCodes) {
    if (!code) continue;

    const matched = masterCourses.find(
      (course) => normalizeCourseCode(course.course_code) === code
    );

    if (matched) {
      return {
        course: matched,
        matchedBy: "COURSE_CODE",
        matchedValue: code,
      };
    }
  }

  const normalizedTitle = normalizeCourseTitle(row.courseTitle);
  if (normalizedTitle) {
    const matched = masterCourses.find((course) => {
      const courseTitle = normalizeCourseTitle(course.course_title);
      const normalizedStored = normalizeUpper(course.normalized_title || "");
      return courseTitle === normalizedTitle || normalizedStored === normalizedTitle;
    });

    if (matched) {
      return {
        course: matched,
        matchedBy: "COURSE_TITLE",
        matchedValue: normalizedTitle,
      };
    }
  }

  return {
    course: null,
    matchedBy: null,
    matchedValue: null,
  };
}

async function resolveTargetProgram(requestedProgramCode: string) {
  const catalogEntry = await prisma.academic_catalog_entries.findFirst({
    where: {
      program_code: requestedProgramCode,
      is_active: true,
    },
    select: {
      department_code: true,
      department_name: true,
      program_code: true,
      program_title: true,
      study_shift: true,
      display_label: true,
      curriculum_key: true,
    },
  });

  if (!catalogEntry) {
    throw new Error("Selected academic identity was not found in Academic Setup.");
  }

  const candidates: ProgramCandidate[] = [];

  const exactProgram = await prisma.programs.findFirst({
    where: {
      short_name: requestedProgramCode,
    },
    select: {
      id: true,
      short_name: true,
      name: true,
    },
  });

  if (exactProgram) {
    candidates.push(exactProgram);
  }

  const canonicalProgram = await resolveCanonicalProgram({
    department_code: catalogEntry.department_code,
    department_name: catalogEntry.department_name,
    program_code: catalogEntry.program_code,
    program_title: catalogEntry.program_title,
    study_shift: catalogEntry.study_shift,
  });

  candidates.push({
    id: canonicalProgram.id,
    short_name: canonicalProgram.short_name,
    name: canonicalProgram.name,
  });

  if (catalogEntry.curriculum_key) {
    const curriculumPrograms = await prisma.programs.findMany({
      where: {
        master_courses: {
          some: {
            curriculum_key: catalogEntry.curriculum_key,
          },
        },
      },
      select: {
        id: true,
        short_name: true,
        name: true,
      },
    });

    candidates.push(...curriculumPrograms);
  }

  const finalCandidates = uniqueById(candidates);
  const primaryProgram = exactProgram || canonicalProgram;

  return {
    requestedProgramCode,
    program: primaryProgram,
    candidateProgramIds: finalCandidates.map((item) => item.id),
    matchedProgramCodes: uniqueStrings([
      requestedProgramCode,
      ...finalCandidates.map((item) => item.short_name),
    ]),
    displayLabel: catalogEntry.display_label,
    curriculumKey: catalogEntry.curriculum_key,
  };
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const formData = await req.formData();

    const requestedProgramCode = String(formData.get("programCode") || "")
      .trim()
      .toUpperCase();
    const termName = String(formData.get("termName") || "")
      .trim()
      .toUpperCase();
    const file = formData.get("file") as File | null;

    if (!requestedProgramCode) {
      return NextResponse.json(
        { ok: false, error: "programCode is required." },
        { status: 400 }
      );
    }

    if (!termName) {
      return NextResponse.json(
        { ok: false, error: "termName is required." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Excel file is required." },
        { status: 400 }
      );
    }

    const resolvedProgramInfo = await resolveTargetProgram(requestedProgramCode);
    const program = resolvedProgramInfo.program;
    const candidateProgramIds = resolvedProgramInfo.candidateProgramIds;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseOfferingTemplateWorkbook(fileBuffer);

    const [masterCourses, teachers, rooms, batches] = await Promise.all([
      prisma.master_courses.findMany({
        where: {
          OR: [
            {
              program_id: {
                in: candidateProgramIds,
              },
            },
            ...(resolvedProgramInfo.curriculumKey
              ? [
                  {
                    curriculum_key: resolvedProgramInfo.curriculumKey,
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ course_code: "asc" }],
      }),
      prisma.teachers.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ teacher_code: "asc" }],
      }),
      prisma.rooms.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ room_code: "asc" }],
      }),
      prisma.batches.findMany({
        where: {
          program_id: {
            in: candidateProgramIds,
          },
          is_active: true,
        },
        include: {
          programs: true,
        },
        orderBy: [{ batch_code: "asc" }],
      }),
    ]);

    const previewRows: PreviewRow[] = parsed.rows.map((row) => {
      const issues: string[] = [];
      let status: PreviewRowStatus = "READY";

      const courseResolution = resolveCourseByCodeOrTitle(row, masterCourses);
      const resolvedCourse = courseResolution.course;

      if (!resolvedCourse) {
        issues.push(
          `Course could not be matched from ${
            row.courseCode || row.coofferedCourseCode || row.courseTitle
          }.`
        );
        status = "BLOCKED";
      }

      const resolvedBatch = resolveBatch(row.batchCode, batches);
      if (!resolvedBatch) {
        issues.push(
          `Batch ${row.batchCode} was not found under any matched program: ${resolvedProgramInfo.matchedProgramCodes.join(
            ", "
          )}.`
        );
        status = "BLOCKED";
      }

      const resolvedTeacher = isBlankLikeFaculty(row.facultyInitial)
        ? null
        : resolveTeacher(row.facultyInitial, teachers);

      const resolvedRoom = row.room ? resolveRoom(row.room, rooms) : null;
      const slotOptional = isSlotOptionalCourseType(row.courseType, row.courseTitle);

      if (!slotOptional) {
        if (!row.parsedSlots.length) {
          issues.push("No valid slot parsed from Slot 1 / Slot 2 + Time.");
          status = status === "BLOCKED" ? "BLOCKED" : "WARNING";
        }

        const invalidSlot = row.parsedSlots.find((slot) => !slot.timeParseOk);
        if (invalidSlot) {
          issues.push(
            `Time parse issue: ${invalidSlot.timeParseReason || "invalid time format"}.`
          );
          status = status === "BLOCKED" ? "BLOCKED" : "WARNING";
        }

        if (!row.room) {
          issues.push("Room is missing.");
          status = status === "BLOCKED" ? "BLOCKED" : "WARNING";
        }

        if (row.room && !resolvedRoom) {
          issues.push(
            `Room ${row.room} was not matched to an active room entry. Slot import will be skipped unless room mapping is fixed.`
          );
          status = status === "BLOCKED" ? "BLOCKED" : "WARNING";
        }
      }

      if (!isBlankLikeFaculty(row.facultyInitial) && row.facultyInitial && !resolvedTeacher) {
        issues.push(
          `Faculty initial ${row.facultyInitial} was not matched to an active faculty.`
        );
        status = status === "BLOCKED" ? "BLOCKED" : "WARNING";
      }

      if (slotOptional) {
        issues.push(
          "Slot/room is optional for this course type and will not be required during import."
        );
        status = status === "BLOCKED" ? "BLOCKED" : "WARNING";
      }

      return {
        rowKey: row.rowKey,
        batchCode: row.batchCode,
        courseTitle: row.courseTitle,
        courseCode: row.courseCode,
        coofferedCourseCode: row.coofferedCourseCode,
        facultyInitial: row.facultyInitial,
        section: row.section,
        credits: row.credits,
        day: row.day,
        rawTime: row.rawTime,
        startTime: row.startTime,
        endTime: row.endTime,
        timeParseOk: row.timeParseOk,
        room: row.room,
        courseType: row.courseType,
        parsedSlots: row.parsedSlots,
        status,
        issues,
        resolvedCourseId: resolvedCourse?.id ?? null,
        resolvedCourseTitle: resolvedCourse?.course_title ?? null,
        resolvedCourseCode: resolvedCourse?.course_code ?? null,
        resolvedCourseMatchedBy: courseResolution.matchedBy || null,
        resolvedCourseMatchedValue: courseResolution.matchedValue || null,
        resolvedBatchId: resolvedBatch?.id ?? null,
        resolvedBatchProgramCode: resolvedBatch?.programs?.short_name ?? null,
        resolvedTeacherId: resolvedTeacher?.id ?? null,
        resolvedTeacherCode: resolvedTeacher?.teacher_code ?? null,
        resolvedRoomId: resolvedRoom?.id ?? null,
        resolvedRoomCode: resolvedRoom?.room_code ?? null,
        slotOptional,
      };
    });

    const readyCount = previewRows.filter((x) => x.status === "READY").length;
    const warningCount = previewRows.filter((x) => x.status === "WARNING").length;
    const blockedCount = previewRows.filter((x) => x.status === "BLOCKED").length;
    const detectedBatchCodes = uniqueStrings(previewRows.map((x) => x.batchCode));

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      requestedProgramCode: resolvedProgramInfo.requestedProgramCode,
      resolvedProgramCode: program.short_name,
      resolvedProgramName: program.name,
      matchedProgramCodes: resolvedProgramInfo.matchedProgramCodes,
      termName,
      sheetName: parsed.sheetName,
      summary: {
        totalRows: previewRows.length,
        totalBatchBlocks: parsed.summary.totalBatchBlocks,
        detectedBatchCodes,
        readyCount,
        warningCount,
        blockedCount,
      },
      previewRows,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Failed to preview offering template.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

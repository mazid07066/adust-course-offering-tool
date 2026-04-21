import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { parseOfferingTemplateWorkbook } from "@/lib/offering-template-parser";
import {
  buildRoomLookupCandidates,
  isBlankLikeFaculty,
  isSlotOptionalCourseType,
  normalizeCourseCode,
  normalizeCourseTitle,
  normalizeRoomCode,
  normalizeTeacherCode,
  parseOneCourseCodeAliases,
  uniqueStrings,
} from "@/lib/offering-template-normalize";
import { resolveProgramForOfferingTemplate } from "@/lib/offering-template-program-resolver";

type PreviewRowStatus = "READY" | "WARNING" | "BLOCKED";

type MasterCourseLite = {
  id: number;
  course_code: string;
  course_title: string;
  credit: number;
};

type StoredRoomLite = {
  id: number;
  room_code: string;
  room_type: string | null;
};

function splitStoredRoomCode(stored: string) {
  const raw = String(stored || "").trim();
  const parts = raw.split("|").map((x) => x.trim());

  if (parts.length >= 2) {
    return {
      roomCode: normalizeRoomCode(parts[0]),
      roomNumber: normalizeRoomCode(parts.slice(1).join(" | ")),
    };
  }

  return {
    roomCode: normalizeRoomCode(raw),
    roomNumber: "",
  };
}

function buildRoomMaps(rooms: StoredRoomLite[]) {
  const byNumber = new Map<string, StoredRoomLite>();
  const byStoredText = new Map<string, StoredRoomLite>();

  for (const room of rooms) {
    const parsed = splitStoredRoomCode(room.room_code);

    if (parsed.roomNumber && !byNumber.has(parsed.roomNumber)) {
      byNumber.set(parsed.roomNumber, room);
    }

    byStoredText.set(normalizeRoomCode(room.room_code), room);

    if (parsed.roomCode) {
      byStoredText.set(parsed.roomCode, room);
    }
  }

  return { byNumber, byStoredText };
}

function resolveRoom(
  rawRoomValue: string,
  roomMaps: ReturnType<typeof buildRoomMaps>
) {
  const candidates = buildRoomLookupCandidates(rawRoomValue);

  for (const candidate of candidates) {
    if (/^\d{2,4}$/.test(candidate)) {
      const byNumber = roomMaps.byNumber.get(candidate);
      if (byNumber) return byNumber;
    }
  }

  for (const candidate of candidates) {
    const byText = roomMaps.byStoredText.get(normalizeRoomCode(candidate));
    if (byText) return byText;
  }

  return null;
}

function resolveMasterCourse(
  rowCourseCode: string,
  rowCoofferedCourseCode: string,
  rowCourseTitle: string,
  masterCourses: MasterCourseLite[]
) {
  const codeMap = new Map(
    masterCourses.map((item) => [normalizeCourseCode(item.course_code), item])
  );

  const titleMap = new Map(
    masterCourses.map((item) => [normalizeCourseTitle(item.course_title), item])
  );

  const directMain = codeMap.get(normalizeCourseCode(rowCourseCode));
  if (directMain) {
    return {
      course: directMain,
      matchedBy: "MAIN_CODE",
      matchedValue: normalizeCourseCode(rowCourseCode),
    };
  }

  const aliasCodes = parseOneCourseCodeAliases(rowCoofferedCourseCode);
  for (const alias of aliasCodes) {
    const found = codeMap.get(alias);
    if (found) {
      return {
        course: found,
        matchedBy: "ALTERNATE_CODE",
        matchedValue: alias,
      };
    }
  }

  const titleMatch = titleMap.get(normalizeCourseTitle(rowCourseTitle));
  if (titleMatch) {
    return {
      course: titleMatch,
      matchedBy: "TITLE",
      matchedValue: normalizeCourseTitle(rowCourseTitle),
    };
  }

  return {
    course: null,
    matchedBy: "",
    matchedValue: "",
  };
}

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const formData = await req.formData();
    const file = formData.get("file");
    const requestedProgramCode = String(formData.get("programCode") || "")
      .trim()
      .toUpperCase();
    const termName = String(formData.get("termName") || "")
      .trim()
      .toUpperCase();

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

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "An Excel file is required." },
        { status: 400 }
      );
    }

    const resolvedProgramInfo = await resolveProgramForOfferingTemplate(
      requestedProgramCode
    );

    const program = resolvedProgramInfo.program;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseOfferingTemplateWorkbook(fileBuffer);

    const [masterCourses, batches, teachers, rooms] = await Promise.all([
      prisma.master_courses.findMany({
        where: {
          program_id: program.id,
          is_active: true,
        },
        select: {
          id: true,
          course_code: true,
          course_title: true,
          credit: true,
        },
      }),
      prisma.batches.findMany({
        where: {
          program_id: program.id,
        },
        select: {
          id: true,
          batch_code: true,
        },
      }),
      prisma.teachers.findMany({
        where: {
          is_active: true,
        },
        select: {
          id: true,
          teacher_code: true,
          full_name: true,
        },
      }),
      prisma.rooms.findMany({
        where: {
          is_active: true,
        },
        select: {
          id: true,
          room_code: true,
          room_type: true,
        },
      }),
    ]);

    const batchMap = new Map(
      batches.map((item) => [String(item.batch_code).trim(), item])
    );

    const teacherMap = new Map(
      teachers.map((item) => [normalizeTeacherCode(item.teacher_code), item])
    );

    const roomMaps = buildRoomMaps(rooms);

    const previewRows = parsed.rows.map((row) => {
      const issues: string[] = [];
      let status: PreviewRowStatus = "READY";

      const courseResolution = resolveMasterCourse(
        row.courseCode,
        row.coofferedCourseCode,
        row.courseTitle,
        masterCourses
      );

      const resolvedCourse = courseResolution.course;
      const resolvedBatch = batchMap.get(String(row.batchCode).trim());
      const resolvedTeacher = !isBlankLikeFaculty(row.facultyInitial)
        ? teacherMap.get(normalizeTeacherCode(row.facultyInitial))
        : null;

      const resolvedRoom = resolveRoom(row.room, roomMaps);
      const slotOptional = isSlotOptionalCourseType(row.courseType, row.courseTitle);

      if (!resolvedBatch) {
        issues.push(
          `Batch ${row.batchCode} is not yet present under internal program ${program.short_name}. It will be treated as an incoming/new batch candidate.`
        );
        status = "WARNING";
      }

      if (!resolvedCourse) {
        issues.push(
          `Course could not be resolved by main code (${row.courseCode}), alternate code (${row.coofferedCourseCode || "-"}) or title (${row.courseTitle}).`
        );
        status = "BLOCKED";
      }

      if (!row.section) {
        issues.push("Section is empty.");
        status = "BLOCKED";
      }

      if (!slotOptional) {
        if (!row.day) {
          issues.push("Day is empty.");
          status = status === "BLOCKED" ? "BLOCKED" : "WARNING";
        }

        if (!row.timeParseOk) {
          issues.push(row.timeParseReason || "Time could not be parsed.");
          status = status === "BLOCKED" ? "BLOCKED" : "WARNING";
        }

        if (row.room && !resolvedRoom) {
          issues.push(
            `Room ${row.room} was not matched to an active room number or stored room label. Slot import will be skipped unless room mapping is fixed.`
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
        ...row,
        status,
        issues,
        resolvedCourseId: resolvedCourse?.id ?? null,
        resolvedCourseTitle: resolvedCourse?.course_title ?? null,
        resolvedCourseCode: resolvedCourse?.course_code ?? null,
        resolvedCourseMatchedBy: courseResolution.matchedBy || null,
        resolvedCourseMatchedValue: courseResolution.matchedValue || null,
        resolvedBatchId: resolvedBatch?.id ?? null,
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
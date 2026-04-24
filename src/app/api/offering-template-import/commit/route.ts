import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { parseAcademicTerm } from "@/lib/semester-utils";
import {
  isBlankLikeFaculty,
  isSlotOptionalCourseType,
  normalizeCourseCode,
  normalizeCourseTitle,
  normalizeTeacherCode,
  parseOneCourseCodeAliases,
} from "@/lib/offering-template-normalize";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import {
  buildPendingManualCoofferNote,
  tryAutoResolvePendingManualCoofferForImportedSection,
} from "@/lib/offering-template-cooffer";

export const runtime = "nodejs";

type CommitRow = {
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
  parsedSlots?: Array<{
    day: string;
    rawTime: string;
    startTime: string;
    endTime: string;
    timeParseOk: boolean;
    timeParseReason: string;
  }>;
  status: "READY" | "WARNING" | "BLOCKED";
};

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
  const directCodes = Array.from(
    new Set(
      [
        normalizeCourseCode(row.courseCode),
        normalizeCourseCode(row.coofferedCourseCode),
        ...parseOneCourseCodeAliases(row.courseCode),
        ...parseOneCourseCodeAliases(row.coofferedCourseCode),
      ].filter(Boolean)
    )
  );

  for (const code of directCodes) {
    const matched = masterCourses.find(
      (course) => normalizeCourseCode(course.course_code) === code
    );

    if (matched) return matched;
  }

  const normalizedTitle = normalizeCourseTitle(row.courseTitle);
  if (normalizedTitle) {
    const matched = masterCourses.find((course) => {
      const courseTitle = normalizeCourseTitle(course.course_title);
      const normalizedStored = normalizeUpper(course.normalized_title || "");
      return courseTitle === normalizedTitle || normalizedStored === normalizedTitle;
    });

    if (matched) return matched;
  }

  return null;
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

  const exactProgram = await prisma.programs.findFirst({
    where: {
      short_name: requestedProgramCode,
    },
  });

  if (exactProgram) {
    return {
      requestedProgramCode,
      program: exactProgram,
      matchedProgramCodes: [requestedProgramCode],
      displayLabel: catalogEntry.display_label,
      curriculumKey: catalogEntry.curriculum_key,
    };
  }

  const canonicalProgram = await resolveCanonicalProgram({
    department_code: catalogEntry.department_code,
    department_name: catalogEntry.department_name,
    program_code: catalogEntry.program_code,
    program_title: catalogEntry.program_title,
    study_shift: catalogEntry.study_shift,
  });

  return {
    requestedProgramCode,
    program: canonicalProgram,
    matchedProgramCodes: [requestedProgramCode, canonicalProgram.short_name],
    displayLabel: catalogEntry.display_label,
    curriculumKey: catalogEntry.curriculum_key,
  };
}

async function ensureAcademicTerm(termName: string) {
  const existing = await prisma.academic_terms.findFirst({
    where: { name: termName },
  });

  if (existing) return existing;

  const parsed = parseAcademicTerm(termName);

  return prisma.academic_terms.create({
    data: {
      name: termName,
      year: parsed.year,
      term_type: parsed.season,
      is_active: true,
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const requestedProgramCode = String(body.programCode || "")
      .trim()
      .toUpperCase();
    const termName = String(body.termName || "")
      .trim()
      .toUpperCase();
    const rows = Array.isArray(body.rows) ? (body.rows as CommitRow[]) : [];

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

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "No preview rows were provided for commit." },
        { status: 400 }
      );
    }

    const blockedRows = rows.filter((row) => row.status === "BLOCKED");
    if (blockedRows.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Blocked rows exist in preview. Fix them before commit.",
          blockedRowCount: blockedRows.length,
        },
        { status: 400 }
      );
    }

    const resolvedProgramInfo = await resolveTargetProgram(requestedProgramCode);
    const program = resolvedProgramInfo.program;
    const academicTerm = await ensureAcademicTerm(termName);

    const [masterCourses, teachers, rooms, batches, existingOffering] = await Promise.all([
      prisma.master_courses.findMany({
        where: {
          program_id: program.id,
        },
        orderBy: [{ course_code: "asc" }],
      }),
      prisma.teachers.findMany({
        where: {
          is_active: true,
        },
      }),
      prisma.rooms.findMany({
        where: {
          is_active: true,
        },
      }),
      prisma.batches.findMany({
        where: {
          program_id: program.id,
        },
      }),
      prisma.offerings.findFirst({
        where: {
          academic_term_id: academicTerm.id,
          program_id: program.id,
        },
      }),
    ]);

    const offering =
      existingOffering ||
      (await prisma.offerings.create({
        data: {
          academic_term_id: academicTerm.id,
          program_id: program.id,
          prepared_by_user_id: 1,
          status: "DRAFT",
        },
      }));

    let createdCourseCount = 0;
    let reusedCourseCount = 0;
    let attachedBatchCount = 0;
    let attachedTeacherCount = 0;
    let addedSlotCount = 0;
    let addedManualCoofferCount = 0;
    let autoResolvedCoofferCount = 0;

    for (const row of rows) {
      const resolvedCourse = resolveCourseByCodeOrTitle(row, masterCourses);
      if (!resolvedCourse) continue;

      const resolvedBatch = resolveBatch(row.batchCode, batches);
      if (!resolvedBatch) continue;

      const resolvedTeacher = isBlankLikeFaculty(row.facultyInitial)
        ? null
        : resolveTeacher(row.facultyInitial, teachers);

      let offeredCourse = await prisma.offered_courses.findFirst({
        where: {
          offering_id: offering.id,
          master_course_id: resolvedCourse.id,
          section: row.section,
        },
      });

      if (!offeredCourse) {
        offeredCourse = await prisma.offered_courses.create({
          data: {
            offering_id: offering.id,
            master_course_id: resolvedCourse.id,
            section: row.section,
            is_cooffered: false,
            notes: null,
          },
        });
        createdCourseCount += 1;
      } else {
        reusedCourseCount += 1;
      }

      const existingBatch = await prisma.offered_course_batches.findFirst({
        where: {
          offered_course_id: offeredCourse.id,
          batch_id: resolvedBatch.id,
        },
        select: { id: true },
      });

      if (!existingBatch) {
        await prisma.offered_course_batches.create({
          data: {
            offered_course_id: offeredCourse.id,
            batch_id: resolvedBatch.id,
          },
        });
        attachedBatchCount += 1;
      }

      if (resolvedTeacher) {
        const existingTeacher = await prisma.offered_course_teachers.findFirst({
          where: {
            offered_course_id: offeredCourse.id,
            teacher_id: resolvedTeacher.id,
          },
          select: { id: true },
        });

        if (!existingTeacher) {
          await prisma.offered_course_teachers.create({
            data: {
              offered_course_id: offeredCourse.id,
              teacher_id: resolvedTeacher.id,
              assigned_credit: Number(resolvedCourse.credit || row.credits || 0),
              load_type: "IMPORTED",
            },
          });
          attachedTeacherCount += 1;
        }
      }

      if (row.coofferedCourseCode) {
        const normalizedManualCode = normalizeCourseCode(row.coofferedCourseCode);

        const existingManual = await prisma.offered_course_manual_cooffers.findFirst({
          where: {
            offered_course_id: offeredCourse.id,
            manual_course_code: normalizedManualCode,
          },
          select: { id: true },
        });

        if (!existingManual) {
          await prisma.offered_course_manual_cooffers.create({
            data: {
              offered_course_id: offeredCourse.id,
              target_program_code: requestedProgramCode,
              manual_course_code: normalizedManualCode,
              note: buildPendingManualCoofferNote({
                sourceProgramCode: requestedProgramCode,
                section: row.section,
                batchCode: row.batchCode,
                importedFrom: "prepared-offering-template",
              }),
            },
          });
          addedManualCoofferCount += 1;
        }
      }

      const autoResolved = await prisma.$transaction(async (tx) => {
        return tryAutoResolvePendingManualCoofferForImportedSection({
          tx,
          currentOfferedCourseId: offeredCourse.id,
          currentCourseCode: row.courseCode,
          currentSection: row.section,
        });
      });

      if (autoResolved?.autoLinked) {
        autoResolvedCoofferCount += 1;
      }

      const slotOptional = isSlotOptionalCourseType(row.courseType, row.courseTitle);

      if (!slotOptional && row.room) {
        const room = resolveRoom(row.room, rooms);

        if (room) {
          const slotsToCreate =
            Array.isArray(row.parsedSlots) && row.parsedSlots.length > 0
              ? row.parsedSlots.filter(
                  (slot) =>
                    slot.day &&
                    slot.timeParseOk &&
                    slot.startTime &&
                    slot.endTime
                )
              : row.day && row.timeParseOk && row.startTime && row.endTime
                ? [
                    {
                      day: row.day,
                      startTime: row.startTime,
                      endTime: row.endTime,
                    },
                  ]
                : [];

          for (const slot of slotsToCreate) {
            const existingSlot = await prisma.offered_course_slots.findFirst({
              where: {
                offered_course_id: offeredCourse.id,
                day_of_week: slot.day,
                start_time: slot.startTime,
                end_time: slot.endTime,
                room_id: room.id,
              },
              select: { id: true },
            });

            if (!existingSlot) {
              await prisma.offered_course_slots.create({
                data: {
                  offered_course_id: offeredCourse.id,
                  day_of_week: slot.day,
                  start_time: slot.startTime,
                  end_time: slot.endTime,
                  room_id: room.id,
                  slot_type: "CLASS",
                },
              });
              addedSlotCount += 1;
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Offering template committed into draft successfully.",
      draftId: offering.id,
      offeringId: offering.id,
      summary: {
        createdCourseCount,
        reusedCourseCount,
        attachedBatchCount,
        attachedTeacherCount,
        addedSlotCount,
        addedManualCoofferCount,
        autoResolvedCoofferCount,
      },
      requestedProgramCode,
      resolvedProgramCode: program.short_name,
      termName,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Failed to commit offering template.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
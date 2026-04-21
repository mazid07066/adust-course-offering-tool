import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { parseAcademicTerm } from "@/lib/semester-utils";
import {
  buildRoomLookupCandidates,
  isBlankLikeFaculty,
  isSlotOptionalCourseType,
  normalizeCourseCode,
  normalizeCourseTitle,
  normalizeRoomCode,
  normalizeTeacherCode,
  parseOneCourseCodeAliases,
} from "@/lib/offering-template-normalize";
import { resolveProgramForOfferingTemplate } from "@/lib/offering-template-program-resolver";

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
  status: "READY" | "WARNING" | "BLOCKED";
};

type MasterCourseLite = {
  id: number;
  course_code: string;
  course_title: string;
};

type StoredRoomLite = {
  id: number;
  room_code: string;
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
  if (directMain) return directMain;

  const aliases = parseOneCourseCodeAliases(rowCoofferedCourseCode);
  for (const alias of aliases) {
    const found = codeMap.get(alias);
    if (found) return found;
  }

  return titleMap.get(normalizeCourseTitle(rowCourseTitle)) || null;
}

async function ensureAcademicTerm(termName: string) {
  const normalized = String(termName || "").trim().toUpperCase();

  if (!normalized) {
    throw new Error("termName is required.");
  }

  const existing = await prisma.academic_terms.findFirst({
    where: {
      name: normalized,
    },
    select: {
      id: true,
      name: true,
      year: true,
      term_type: true,
      is_active: true,
    },
  });

  if (existing) return existing;

  const parsed = parseAcademicTerm(normalized);

  return prisma.academic_terms.create({
    data: {
      name: normalized,
      year: parsed.year,
      term_type: parsed.season,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      year: true,
      term_type: true,
      is_active: true,
    },
  });
}

async function resolvePreparedByUserId() {
  const adminOrCoordinator = await prisma.users.findFirst({
    where: {
      is_active: true,
      role: {
        in: ["SUPER_ADMIN", "COORDINATOR"],
      },
    },
    orderBy: {
      id: "asc",
    },
    select: {
      id: true,
    },
  });

  if (adminOrCoordinator) return adminOrCoordinator.id;

  const anyActiveUser = await prisma.users.findFirst({
    where: {
      is_active: true,
    },
    orderBy: {
      id: "asc",
    },
    select: {
      id: true,
    },
  });

  if (anyActiveUser) return anyActiveUser.id;

  throw new Error(
    "No active user found in users table. Please ensure at least one active SUPER_ADMIN or COORDINATOR user exists."
  );
}

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const body = await req.json();

    const requestedProgramCode = String(body.programCode || "").trim().toUpperCase();
    const termName = String(body.termName || "").trim().toUpperCase();
    const rows: CommitRow[] = Array.isArray(body.rows) ? body.rows : [];

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

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "rows are required." },
        { status: 400 }
      );
    }

    const importableRows = rows.filter((row) => row.status !== "BLOCKED");

    if (importableRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "There are no importable rows. Preview first and fix blocked rows." },
        { status: 400 }
      );
    }

    const resolvedProgramInfo = await resolveProgramForOfferingTemplate(
      requestedProgramCode
    );
    const program = resolvedProgramInfo.program;

    const [term, preparedByUserId, masterCourses, existingBatches, teachers, rooms] =
      await Promise.all([
        ensureAcademicTerm(termName),
        resolvePreparedByUserId(),
        prisma.master_courses.findMany({
          where: {
            program_id: program.id,
            is_active: true,
          },
          select: {
            id: true,
            course_code: true,
            course_title: true,
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
          },
        }),
        prisma.rooms.findMany({
          where: {
            is_active: true,
          },
          select: {
            id: true,
            room_code: true,
          },
        }),
      ]);

    const teacherMap = new Map(
      teachers.map((item) => [normalizeTeacherCode(item.teacher_code), item])
    );

    const roomMaps = buildRoomMaps(rooms);

    const batchMap = new Map(
      existingBatches.map((item) => [String(item.batch_code).trim(), item])
    );

    let draft = await prisma.offerings.findFirst({
      where: {
        program_id: program.id,
        academic_term_id: term.id,
        status: "DRAFT",
      },
      orderBy: {
        id: "desc",
      },
      select: {
        id: true,
      },
    });

    if (!draft) {
      draft = await prisma.offerings.create({
        data: {
          status: "DRAFT",
          academic_terms: {
            connect: { id: term.id },
          },
          programs: {
            connect: { id: program.id },
          },
          users: {
            connect: { id: preparedByUserId },
          },
        },
        select: {
          id: true,
        },
      });
    }

    let createdCourseCount = 0;
    let reusedCourseCount = 0;
    let attachedBatchCount = 0;
    let createdBatchCount = 0;
    let addedTeacherCount = 0;
    let addedSlotCount = 0;
    let addedManualCoofferCount = 0;
    const skippedRows: string[] = [];

    for (const row of importableRows) {
      const resolvedMasterCourse = resolveMasterCourse(
        row.courseCode,
        row.coofferedCourseCode,
        row.courseTitle,
        masterCourses
      );

      if (!resolvedMasterCourse || !row.section) {
        skippedRows.push(
          `${row.batchCode} | ${row.courseCode} | Section ${row.section || "-"}`
        );
        continue;
      }

      let batch = batchMap.get(String(row.batchCode).trim());

      if (!batch) {
        batch = await prisma.batches.create({
          data: {
            program_id: program.id,
            batch_code: String(row.batchCode).trim(),
            admission_term: null,
            is_active: true,
          },
          select: {
            id: true,
            batch_code: true,
          },
        });

        batchMap.set(String(batch.batch_code).trim(), batch);
        createdBatchCount += 1;
      }

      let offeredCourse = await prisma.offered_courses.findFirst({
        where: {
          offering_id: draft.id,
          master_course_id: resolvedMasterCourse.id,
          section: row.section,
        },
        select: {
          id: true,
        },
      });

      if (!offeredCourse) {
        offeredCourse = await prisma.offered_courses.create({
          data: {
            offering_id: draft.id,
            master_course_id: resolvedMasterCourse.id,
            section: row.section,
            is_cooffered: false,
            notes: `Imported from offering template | Batch ${row.batchCode}`,
          },
          select: {
            id: true,
          },
        });
        createdCourseCount += 1;
      } else {
        reusedCourseCount += 1;
      }

      const existingBatchLink = await prisma.offered_course_batches.findFirst({
        where: {
          offered_course_id: offeredCourse.id,
          batch_id: batch.id,
        },
        select: { id: true },
      });

      if (!existingBatchLink) {
        await prisma.offered_course_batches.create({
          data: {
            offered_course_id: offeredCourse.id,
            batch_id: batch.id,
          },
        });
        attachedBatchCount += 1;
      }

      if (row.coofferedCourseCode) {
        const existingManual = await prisma.offered_course_manual_cooffers.findFirst({
          where: {
            offered_course_id: offeredCourse.id,
            manual_course_code: normalizeCourseCode(row.coofferedCourseCode),
            target_program_code: requestedProgramCode,
          },
          select: { id: true },
        });

        if (!existingManual) {
          await prisma.offered_course_manual_cooffers.create({
            data: {
              offered_course_id: offeredCourse.id,
              target_program_code: requestedProgramCode,
              manual_course_code: normalizeCourseCode(row.coofferedCourseCode),
              note: "Imported from prepared offering template",
            },
          });
          addedManualCoofferCount += 1;
        }
      }

      if (!isBlankLikeFaculty(row.facultyInitial) && row.facultyInitial) {
        const teacher = teacherMap.get(normalizeTeacherCode(row.facultyInitial));

        if (teacher) {
          const existingTeacher = await prisma.offered_course_teachers.findFirst({
            where: {
              offered_course_id: offeredCourse.id,
              teacher_id: teacher.id,
            },
            select: { id: true },
          });

          if (!existingTeacher) {
            await prisma.offered_course_teachers.create({
              data: {
                offered_course_id: offeredCourse.id,
                teacher_id: teacher.id,
                assigned_credit: Number(row.credits || 0),
                load_type: "AUTO_IMPORTED",
              },
            });
            addedTeacherCount += 1;
          }
        }
      }

      const slotOptional = isSlotOptionalCourseType(row.courseType, row.courseTitle);

      if (!slotOptional && row.day && row.timeParseOk && row.startTime && row.endTime && row.room) {
        const room = resolveRoom(row.room, roomMaps);

        if (room) {
          const existingSlot = await prisma.offered_course_slots.findFirst({
            where: {
              offered_course_id: offeredCourse.id,
              day_of_week: row.day,
              start_time: row.startTime,
              end_time: row.endTime,
              room_id: room.id,
            },
            select: { id: true },
          });

          if (!existingSlot) {
            await prisma.offered_course_slots.create({
              data: {
                offered_course_id: offeredCourse.id,
                day_of_week: row.day,
                start_time: row.startTime,
                end_time: row.endTime,
                room_id: room.id,
                slot_type: "CLASS",
              },
            });
            addedSlotCount += 1;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      requestedProgramCode: resolvedProgramInfo.requestedProgramCode,
      resolvedProgramCode: program.short_name,
      resolvedProgramName: program.name,
      matchedProgramCodes: resolvedProgramInfo.matchedProgramCodes,
      draftId: draft.id,
      summary: {
        importedRowCount: importableRows.length,
        createdCourseCount,
        reusedCourseCount,
        attachedBatchCount,
        createdBatchCount,
        addedTeacherCount,
        addedSlotCount,
        addedManualCoofferCount,
        skippedCount: skippedRows.length,
      },
      skippedRows,
      message: "Offering template imported into draft successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import offering template into draft.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
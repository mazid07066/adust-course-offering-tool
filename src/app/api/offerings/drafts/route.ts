import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source: "EXACT_PROGRAM_CODE" | "CANONICAL_PROGRAM";
};

function formatRoomLabel(room: { room_code: string; room_type?: string | null } | null) {
  if (!room) return "-";
  return room.room_type ? `${room.room_type} | ${room.room_code}` : room.room_code;
}

function uniqueById<T extends { id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

async function getStrictProgramCandidates(programCode: string): Promise<ProgramCandidate[]> {
  const normalizedProgramCode = String(programCode || "").trim().toUpperCase();

  if (!normalizedProgramCode) {
    throw new Error("programCode is required.");
  }

  const staticCatalog = getCatalogProgramByCode(normalizedProgramCode);
  if (!staticCatalog) {
    throw new Error("Invalid academic identity programCode.");
  }

  const catalogEntry = await prisma.academic_catalog_entries.findUnique({
    where: {
      program_code: normalizedProgramCode,
    },
    select: {
      department_code: true,
      department_name: true,
      program_title: true,
      study_shift: true,
    },
  });

  const candidates: ProgramCandidate[] = [];

  const exactProgram = await prisma.programs.findFirst({
    where: {
      short_name: normalizedProgramCode,
    },
    select: {
      id: true,
      short_name: true,
      name: true,
    },
  });

  if (exactProgram) {
    candidates.push({
      ...exactProgram,
      source: "EXACT_PROGRAM_CODE",
    });
  }

  const canonicalProgram = await resolveCanonicalProgram({
    department_code: catalogEntry?.department_code || staticCatalog.departmentCode,
    department_name: catalogEntry?.department_name || staticCatalog.departmentName,
    program_code: normalizedProgramCode,
    program_title: catalogEntry?.program_title || staticCatalog.programTitle,
    study_shift: catalogEntry?.study_shift || staticCatalog.studyShift,
  });

  if (!candidates.some((item) => item.id === canonicalProgram.id)) {
    candidates.push({
      id: canonicalProgram.id,
      short_name: canonicalProgram.short_name,
      name: canonicalProgram.name,
      source: "CANONICAL_PROGRAM",
    });
  }

  return uniqueById(candidates);
}

export async function GET(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const { searchParams } = new URL(req.url);
    const programCode = String(searchParams.get("programCode") || "").trim().toUpperCase();
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

    if (!programCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "programCode is required.",
        },
        { status: 400 }
      );
    }

    if (!termName) {
      return NextResponse.json(
        {
          ok: false,
          error: "termName is required.",
        },
        { status: 400 }
      );
    }

    const candidates = await getStrictProgramCandidates(programCode);

    const drafts = await prisma.offerings.findMany({
      where: {
        status: "DRAFT",
        academic_terms: {
          name: termName,
        },
        program_id: {
          in: candidates.map((item) => item.id),
        },
      },
      orderBy: [
        { id: "desc" },
      ],
      include: {
        academic_terms: true,
        programs: true,
        offered_courses: {
          orderBy: [{ id: "asc" }],
          include: {
            master_courses: true,
            offered_course_batches: {
              include: {
                batches: true,
              },
            },
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
            offered_course_slots: {
              orderBy: [
                { day_of_week: "asc" },
                { start_time: "asc" },
                { id: "asc" },
              ],
              include: {
                rooms: true,
              },
            },
          },
        },
      },
    });

    const payload = drafts.map((draft) => ({
      id: draft.id,
      status: draft.status,
      created_at: draft.created_at ? draft.created_at.toISOString() : null,
      academic_terms: {
        name: draft.academic_terms.name,
      },
      programs: {
        short_name: draft.programs.short_name,
        name: draft.programs.name,
      },
      offered_courses: draft.offered_courses.map((course) => ({
        id: course.id,
        section: course.section,
        master_courses: {
          course_code: course.master_courses.course_code,
          course_title: course.master_courses.course_title,
        },
        offered_course_batches: course.offered_course_batches.map((x) => ({
          batches: {
            batch_code: x.batches.batch_code,
          },
        })),
        offered_course_teachers: course.offered_course_teachers.map((x) => ({
          teachers: x.teachers
            ? {
                teacher_code: x.teachers.teacher_code,
                full_name: x.teachers.full_name,
              }
            : null,
        })),
        offered_course_slots: course.offered_course_slots.map((slot) => ({
          id: slot.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          room_id: slot.room_id,
          slot_type: slot.slot_type,
          rooms: slot.rooms
            ? {
                room_code: slot.rooms.room_code,
                room_type: slot.rooms.room_type,
              }
            : null,
        })),
        schedule_text:
          course.offered_course_slots.length > 0
            ? course.offered_course_slots
                .map(
                  (slot) =>
                    `${slot.day_of_week} ${slot.start_time}-${slot.end_time} (${formatRoomLabel(
                      slot.rooms
                    )})`
                )
                .join(" | ")
            : "-",
      })),
    }));

    return NextResponse.json({
      ok: true,
      requestedProgramCode: programCode,
      matchedProgramCodes: candidates.map((item) => item.short_name),
      drafts: payload,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load draft offerings.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
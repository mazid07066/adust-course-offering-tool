import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";
import {
  isSlotOptionalCourse,
  SCHEDULE_CONFLICT_STATUSES,
} from "@/lib/course-schedule-policy";
import { getCatalogProgramByCode } from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import { getExcludedBatchIdsForTerm } from "@/lib/batch-term-offering-status";

type SlotInput = {
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  roomId?: number | string;
  slotType?: string;
};

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source:
    | "EXACT_PROGRAM_CODE"
    | "CANONICAL_PROGRAM"
    | "CURRICULUM_RELATED_PROGRAM";
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function hasTimeOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);

  if (aS === null || aE === null || bS === null || bE === null) return false;

  return aS < bE && bS < aE;
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

function sourcePriority(source: ProgramCandidate["source"]) {
  if (source === "CANONICAL_PROGRAM") return 1;
  if (source === "EXACT_PROGRAM_CODE") return 2;
  return 3;
}

function offeringStatusPriority(status: string) {
  const clean = normalizeUpper(status);

  if (clean === "FACULTY_CHOICE_FINALIZED") return 1;
  if (clean === "FACULTY_CHOICE_BUFFER") return 2;
  if (clean === "BUFFER_READY") return 3;
  if (clean === "DRAFT") return 4;
  if (clean === "CONFIRMED") return 99;

  return 50;
}

async function getProgramCandidates(programCode: string): Promise<{
  normalizedProgramCode: string;
  candidateIds: number[];
  candidates: ProgramCandidate[];
}> {
  const normalizedProgramCode = normalizeUpper(programCode);

  const staticCatalog = getCatalogProgramByCode(normalizedProgramCode);

  if (!staticCatalog) {
    throw new Error("Invalid academic identity programCode.");
  }

  const catalogEntry = await prisma.academic_catalog_entries.findUnique({
    where: {
      program_code: normalizedProgramCode,
    },
    select: {
      curriculum_key: true,
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
    department_code:
      catalogEntry?.department_code || staticCatalog.departmentCode,
    department_name:
      catalogEntry?.department_name || staticCatalog.departmentName,
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

  const curriculumKey = catalogEntry?.curriculum_key || null;

  if (curriculumKey) {
    const relatedCatalogEntries = await prisma.academic_catalog_entries.findMany({
      where: {
        curriculum_key: curriculumKey,
        is_active: true,
      },
      select: {
        program_code: true,
      },
    });

    const relatedProgramCodes = relatedCatalogEntries
      .map((item) => item.program_code)
      .filter(Boolean);

    const relatedPrograms = await prisma.programs.findMany({
      where: {
        short_name: {
          in: relatedProgramCodes,
        },
      },
      select: {
        id: true,
        short_name: true,
        name: true,
      },
    });

    for (const item of relatedPrograms) {
      if (!candidates.some((row) => row.id === item.id)) {
        candidates.push({
          ...item,
          source: "CURRICULUM_RELATED_PROGRAM",
        });
      }
    }
  }

  const uniqueCandidates = uniqueById(candidates);

  return {
    normalizedProgramCode,
    candidateIds: uniqueCandidates.map((item) => item.id),
    candidates: uniqueCandidates,
  };
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const termName = normalizeUpper(body.termName);
    const programCode = normalizeUpper(body.programCode);
    const rawBatchIds: unknown[] =
      Array.isArray(body.batchIds)
        ? body.batchIds
        : [body.batchId];

    const batchIds: number[] = Array.from(
      new Set(
        rawBatchIds
          .map((value: unknown) => toNumber(value))
          .filter((value): value is number => value !== null)
      )
    );
    const masterCourseId = toNumber(body.masterCourseId);
    const targetOfferingId = toNumber(body.targetOfferingId);
    const section = normalizeUpper(body.section || "1");
    const teacherId = toNumber(body.teacherId);
    const loadType = normalizeUpper(body.loadType || "MANUAL");
    const slots: SlotInput[] = Array.isArray(body.slots) ? body.slots : [];

    if (
      !termName ||
      !programCode ||
      batchIds.length === 0 ||
      !masterCourseId ||
      !section
    ) {
      return NextResponse.json(
        {
          error:
            "termName, programCode, batchId, masterCourseId, and section are required.",
        },
        { status: 400 }
      );
    }

    if (batchIds.length !== 1) {
      return NextResponse.json(
        {
          error:
            "Create the manual offering for one batch first. Use Add Batch after the offered course is saved.",
        },
        { status: 400 }
      );
    }

    const resolved = await getProgramCandidates(programCode);

    if (resolved.candidateIds.length === 0) {
      return NextResponse.json(
        { error: "No valid program records found for selected academic identity." },
        { status: 404 }
      );
    }

    const [term, selectedBatches, masterCourse] = await Promise.all([
      prisma.academic_terms.findFirst({
        where: { name: termName },
        select: { id: true, name: true },
      }),
      prisma.batches.findMany({
        where: { id: { in: batchIds } },
        select: { id: true, program_id: true, batch_code: true },
      }),
      prisma.master_courses.findUnique({
        where: { id: masterCourseId },
        select: {
          id: true,
          program_id: true,
          course_code: true,
          course_title: true,
          course_type: true,
          credit: true,
        },
      }),
    ]);

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    if (selectedBatches.length !== batchIds.length) {
      return NextResponse.json(
        { error: "One or more selected batches were not found." },
        { status: 400 }
      );
    }

    const invalidBatch = selectedBatches.find(
      (batch) => !resolved.candidateIds.includes(batch.program_id)
    );

    if (invalidBatch) {
      return NextResponse.json(
        {
          error: `Batch ${invalidBatch.batch_code} does not belong to the selected program identity.`,
        },
        { status: 400 }
      );
    }

    const excludedBatchIds = await getExcludedBatchIdsForTerm(term.id, batchIds);
    const excludedBatch = selectedBatches.find((batch) =>
      excludedBatchIds.has(batch.id)
    );

    if (excludedBatch) {
      return NextResponse.json(
        {
          error: `Batch ${excludedBatch.batch_code} is excluded from course offering for this academic term.`,
        },
        { status: 409 }
      );
    }

    if (!masterCourse || !resolved.candidateIds.includes(masterCourse.program_id)) {
      return NextResponse.json(
        { error: "Selected course does not belong to selected program identity." },
        { status: 400 }
      );
    }

    const normalizeEligibilityCode = (value: unknown) =>
      String(value || "").replace(/\s+/g, "").trim().toUpperCase();

    const normalizeEligibilityTitle = (value: unknown) =>
      String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

    const selectedCourseCode = normalizeEligibilityCode(masterCourse.course_code);
    const selectedCourseTitle = normalizeEligibilityTitle(masterCourse.course_title);

    for (const selectedBatch of selectedBatches) {
      const logicalBatchRows = await prisma.batches.findMany({
        where: {
          program_id: { in: resolved.candidateIds },
          batch_code: selectedBatch.batch_code,
        },
        select: { id: true },
      });

      const logicalBatchIds = logicalBatchRows.map((item) => item.id);

      const [completedCourses, ongoingCourses] = await Promise.all([
        prisma.batch_completed_courses.findMany({
          where: { batch_id: { in: logicalBatchIds } },
          select: {
            course_code: true,
            course_title: true,
            normalized_title: true,
          },
        }),
        prisma.batch_current_registrations.findMany({
          where: { batch_id: { in: logicalBatchIds } },
          select: {
            course_code: true,
            course_title: true,
            normalized_title: true,
          },
        }),
      ]);

      const alreadyCompleted = completedCourses.some(
        (item) =>
          normalizeEligibilityCode(item.course_code) === selectedCourseCode ||
          normalizeEligibilityTitle(item.normalized_title || item.course_title) ===
            selectedCourseTitle
      );

      if (alreadyCompleted) {
        return NextResponse.json(
          {
            error: `Selected course is already completed by batch ${selectedBatch.batch_code}.`,
          },
          { status: 409 }
        );
      }

      const currentlyOngoing = ongoingCourses.some(
        (item) =>
          normalizeEligibilityCode(item.course_code) === selectedCourseCode ||
          normalizeEligibilityTitle(item.normalized_title || item.course_title) ===
            selectedCourseTitle
      );

      if (currentlyOngoing) {
        return NextResponse.json(
          {
            error: `Selected course is currently ongoing for batch ${selectedBatch.batch_code}.`,
          },
          { status: 409 }
        );
      }
    }


    let offering = targetOfferingId
      ? await prisma.offerings.findFirst({
          where: {
            id: targetOfferingId,
            academic_term_id: term.id,
            program_id: {
              in: resolved.candidateIds,
            },
          },
        })
      : null;

    if (!offering) {
      const offerings = await prisma.offerings.findMany({
        where: {
          academic_term_id: term.id,
          program_id: {
            in: resolved.candidateIds,
          },
        },
      });

      offering =
        offerings
          .filter((item) => item.status !== "CONFIRMED")
          .sort((a, b) => {
            const statusDiff =
              offeringStatusPriority(a.status) - offeringStatusPriority(b.status);
            if (statusDiff !== 0) return statusDiff;
            return b.id - a.id;
          })[0] || null;
    }

    if (!offering) {
      const preferredProgram =
        resolved.candidates.sort(
          (a, b) => sourcePriority(a.source) - sourcePriority(b.source)
        )[0];

      offering = await prisma.offerings.create({
        data: {
          academic_term_id: term.id,
          program_id: preferredProgram.id,
          prepared_by_user_id: 1,
          status: "FACULTY_CHOICE_BUFFER",
        },
      });
    }

    if (offering.status === "CONFIRMED") {
      return NextResponse.json(
        { error: "Cannot manually add courses to a confirmed offering." },
        { status: 400 }
      );
    }

    const slotOptional = isSlotOptionalCourse({
      course_code: masterCourse.course_code,
      course_title: masterCourse.course_title,
      course_type: masterCourse.course_type,
    });

    const cleanSlots = slots
      .map((slot) => ({
        dayOfWeek: normalizeUpper(slot.dayOfWeek),
        startTime: normalizeText(slot.startTime),
        endTime: normalizeText(slot.endTime),
        roomId: toNumber(slot.roomId),
        slotType: normalizeUpper(slot.slotType || "CLASS"),
      }))
      .filter(
        (slot) =>
          slot.dayOfWeek &&
          slot.startTime &&
          slot.endTime &&
          slot.roomId &&
          timeToMinutes(slot.startTime) !== null &&
          timeToMinutes(slot.endTime) !== null
      );

    if (!slotOptional && cleanSlots.length === 0) {
      return NextResponse.json(
        { error: "This course requires at least one valid slot." },
        { status: 400 }
      );
    }

    for (const slot of cleanSlots) {
      const start = timeToMinutes(slot.startTime);
      const end = timeToMinutes(slot.endTime);

      if (start === null || end === null || start >= end) {
        return NextResponse.json(
          { error: "Each slot must have a valid start and end time." },
          { status: 400 }
        );
      }
    }

    const duplicate = await prisma.offered_courses.findFirst({
      where: {
        offering_id: offering.id,
        master_course_id: masterCourse.id,
        section,
        offered_course_batches: {
          some: { batch_id: { in: batchIds } },
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      const duplicateBatchLinks = await prisma.offered_course_batches.findMany({
        where: {
          offered_course_id: duplicate.id,
          batch_id: { in: batchIds },
        },
        select: { batch_id: true },
      });

      const duplicateBatchIds = new Set(
        duplicateBatchLinks.map((item) => item.batch_id)
      );

      const overlapping = selectedBatches
        .filter((batch) => duplicateBatchIds.has(batch.id))
        .map((batch) => batch.batch_code)
        .join(", ");

      return NextResponse.json(
        {
          error: `This course and section already exists for selected batch(es): ${overlapping || "unknown"}. Edit the existing offered course to add more batches.`,
        },
        { status: 409 }
      );
    }

    for (const slot of cleanSlots) {
      const roomSlots = await prisma.offered_course_slots.findMany({
        where: {
          day_of_week: slot.dayOfWeek,
          room_id: slot.roomId!,
          offered_courses: {
            offerings: {
              academic_term_id: term.id,
              status: { in: SCHEDULE_CONFLICT_STATUSES },
            },
          },
        },
        include: {
          offered_courses: { include: { master_courses: true } },
          rooms: true,
        },
      });

      const roomConflict = roomSlots.find((existing) =>
        hasTimeOverlap(
          slot.startTime,
          slot.endTime,
          existing.start_time,
          existing.end_time
        )
      );

      if (roomConflict) {
        return NextResponse.json(
          {
            error: `Room conflict: ${roomConflict.rooms.room_code} already has ${roomConflict.offered_courses.master_courses.course_code} Sec-${roomConflict.offered_courses.section} at ${roomConflict.day_of_week} ${roomConflict.start_time}-${roomConflict.end_time}.`,
          },
          { status: 409 }
        );
      }

      const batchSlots = await prisma.offered_course_slots.findMany({
        where: {
          day_of_week: slot.dayOfWeek,
          offered_courses: {
            offerings: {
              academic_term_id: term.id,
              status: { in: SCHEDULE_CONFLICT_STATUSES },
            },
            offered_course_batches: {
              some: { batch_id: { in: batchIds } },
            },
          },
        },
        select: {
          offered_course_id: true,
          day_of_week: true,
          start_time: true,
          end_time: true,
        },
      });

      const batchConflict = batchSlots.find((existing) =>
        hasTimeOverlap(
          slot.startTime,
          slot.endTime,
          existing.start_time,
          existing.end_time
        )
      );

      if (batchConflict) {
        const [conflictingCourse, conflictBatchLinks] = await Promise.all([
          prisma.offered_courses.findUnique({
            where: { id: batchConflict.offered_course_id },
            select: {
              section: true,
              master_courses: {
                select: { course_code: true },
              },
            },
          }),
          prisma.offered_course_batches.findMany({
            where: {
              offered_course_id: batchConflict.offered_course_id,
              batch_id: { in: batchIds },
            },
            select: { batch_id: true },
          }),
        ]);

        const conflictBatchIds = new Set(
          conflictBatchLinks.map((item) => item.batch_id)
        );

        const conflictingBatches = selectedBatches
          .filter((batch) => conflictBatchIds.has(batch.id))
          .map((batch) => batch.batch_code)
          .join(", ");

        return NextResponse.json(
          {
            error: `Batch schedule conflict for batch(es) ${conflictingBatches || "unknown"}: ${conflictingCourse?.master_courses.course_code || "course"} Sec-${conflictingCourse?.section || "-"} already runs ${batchConflict.day_of_week} ${batchConflict.start_time}-${batchConflict.end_time}.`,
          },
          { status: 409 }
        );
      }

      if (teacherId) {
        const teacherSlots = await prisma.offered_course_slots.findMany({
          where: {
            day_of_week: slot.dayOfWeek,
            offered_courses: {
              offerings: {
                academic_term_id: term.id,
                status: { in: SCHEDULE_CONFLICT_STATUSES },
              },
              offered_course_teachers: {
                some: { teacher_id: teacherId },
              },
            },
          },
          include: {
            offered_courses: { include: { master_courses: true } },
          },
        });

        const teacherConflict = teacherSlots.find((existing) =>
          hasTimeOverlap(
            slot.startTime,
            slot.endTime,
            existing.start_time,
            existing.end_time
          )
        );

        if (teacherConflict) {
          return NextResponse.json(
            {
              error: `Faculty schedule conflict: selected faculty already has ${teacherConflict.offered_courses.master_courses.course_code} Sec-${teacherConflict.offered_courses.section} at ${teacherConflict.day_of_week} ${teacherConflict.start_time}-${teacherConflict.end_time}.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const offeredCourse = await tx.offered_courses.create({
        data: {
          offering_id: offering.id,
          master_course_id: masterCourse.id,
          section,
          is_cooffered: false,
          notes: "MANUAL_ADDITION",
        },
      });

      await tx.offered_course_batches.createMany({
        data: batchIds.map((batchId) => ({
          offered_course_id: offeredCourse.id,
          batch_id: batchId,
        })),
      });

      for (const slot of cleanSlots) {
        await tx.offered_course_slots.create({
          data: {
            offered_course_id: offeredCourse.id,
            day_of_week: slot.dayOfWeek,
            start_time: slot.startTime,
            end_time: slot.endTime,
            room_id: slot.roomId!,
            slot_type: slot.slotType,
          },
        });
      }

      if (teacherId) {
        await tx.offered_course_teachers.create({
          data: {
            offered_course_id: offeredCourse.id,
            teacher_id: teacherId,
            assigned_credit: Number(masterCourse.credit || 0),
            load_type: loadType || "MANUAL",
          },
        });
      }

      return offeredCourse;
    });

    clearReportingCacheWithLog("manual offered course created");

    return NextResponse.json({
      success: true,
      message: `Manual offered course added for batch ${selectedBatches[0].batch_code} into offering #${offering.id} (${offering.status}).`,
      offeredCourseId: created.id,
      offeringId: offering.id,
      offeringStatus: offering.status,
    });
  } catch (error) {
    console.error("Manual offering create failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create manual offered course.",
      },
      { status: 500 }
    );
  }
}
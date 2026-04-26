import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getSectionGroupBatchIds, getSectionGroupCourseIds } from "@/lib/offering-section-group";
import { canModifySlots } from "@/lib/offering-status";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

const ALLOWED_DAYS = ["THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "MONDAY"];
const ALLOWED_DURATIONS_MINUTES = [60, 90, 120, 180];

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function timeToMinutes(value: string) {
  const [hh, mm] = value.split(":").map(Number);
  return hh * 60 + mm;
}

function inferSlotTypeFromDuration(durationMinutes: number) {
  if (durationMinutes === 60 || durationMinutes === 90) {
    return "CLASS";
  }

  if (durationMinutes === 120 || durationMinutes === 180) {
    return "LAB";
  }

  return "CLASS";
}

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const body = await req.json();

    const offeredCourseId = Number(body.offeredCourseId);
    const dayOfWeek = String(body.dayOfWeek || "").trim().toUpperCase();
    const startTime = String(body.startTime || "").trim();
    const endTime = String(body.endTime || "").trim();
    const roomId = Number(body.roomId);

    if (!Number.isFinite(offeredCourseId) || offeredCourseId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid offeredCourseId is required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_DAYS.includes(dayOfWeek)) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "dayOfWeek must be one of THURSDAY, FRIDAY, SATURDAY, SUNDAY, MONDAY.",
        },
        { status: 400 }
      );
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "startTime and endTime must be in HH:MM format.",
        },
        { status: 400 }
      );
    }

    if (startTime >= endTime) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "endTime must be later than startTime.",
        },
        { status: 400 }
      );
    }

    const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);

    if (!ALLOWED_DURATIONS_MINUTES.includes(durationMinutes)) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "Allowed slot durations are 1 hour, 1.5 hours, 2 hours, and 3 hours only.",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(roomId) || roomId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Valid roomId is required." },
        { status: 400 }
      );
    }

    const offeredCourse = await prisma.offered_courses.findUnique({
      where: {
        id: offeredCourseId,
      },
      select: {
        id: true,
        offering_id: true,
        primary_offered_course_id: true,
        offered_course_slots: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!offeredCourse) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Offered course not found." },
        { status: 404 }
      );
    }

    const offeringStatus = await prisma.offerings.findFirst({
      where: {
        id: offeredCourse.offering_id,
      },
      select: {
        status: true,
      },
    });

    if (!offeringStatus || !canModifySlots(offeringStatus.status)) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "Slot modification not allowed in current offering stage.",
        },
        { status: 400 }
      );
    }

    if (offeredCourse.primary_offered_course_id) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Slots can only be managed from the primary section row." },
        { status: 400 }
      );
    }

    if (offeredCourse.offered_course_slots.length >= 3) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "A course section can have at most 3 weekly slots.",
        },
        { status: 400 }
      );
    }

    const room = await prisma.rooms.findUnique({
      where: {
        id: roomId,
      },
      select: {
        id: true,
        is_active: true,
        room_code: true,
      },
    });

    if (!room || !room.is_active) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { ok: false, error: "Selected room is invalid or inactive." },
        { status: 400 }
      );
    }

    const groupCourseIds = await prisma.$transaction((tx) =>
      getSectionGroupCourseIds(tx, offeredCourseId)
    );

    const batchIds = await prisma.$transaction((tx) =>
      getSectionGroupBatchIds(tx, offeredCourseId)
    );

    const batchRows = await prisma.batches.findMany({
      where: {
        id: {
          in: batchIds,
        },
      },
      select: {
        batch_code: true,
      },
    });

    const batchCodes = batchRows.map((x) => x.batch_code);

    const overlappingBatchSlot = await prisma.offered_course_slots.findFirst({
      where: {
        day_of_week: dayOfWeek,
        start_time: {
          lt: endTime,
        },
        end_time: {
          gt: startTime,
        },
        offered_course_id: {
          notIn: groupCourseIds,
        },
        offered_courses: {
          offerings: {
            status: {
              in: ["DRAFT", "CONFIRMED"],
            },
          },
          offered_course_batches: {
            some: {
              batch_id: {
                in: batchIds,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (overlappingBatchSlot) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: `Batch slot conflict detected for batch ${batchCodes.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const overlappingRoomSlot = await prisma.offered_course_slots.findFirst({
      where: {
        room_id: roomId,
        day_of_week: dayOfWeek,
        start_time: {
          lt: endTime,
        },
        end_time: {
          gt: startTime,
        },
        offered_course_id: {
          notIn: groupCourseIds,
        },
        offered_courses: {
          offerings: {
            status: {
              in: ["DRAFT", "CONFIRMED"],
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (overlappingRoomSlot) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: `Room conflict detected. Room ${room.room_code} is already occupied for the selected overlapping time.`,
        },
        { status: 400 }
      );
    }

    const duplicateSameSlot = await prisma.offered_course_slots.findFirst({
      where: {
        offered_course_id: offeredCourseId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
      },
      select: {
        id: true,
      },
    });

    if (duplicateSameSlot) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "This exact slot already exists for the selected offered course.",
        },
        { status: 400 }
      );
    }

    const slotType = inferSlotTypeFromDuration(durationMinutes);

    const slot = await prisma.offered_course_slots.create({
      data: {
        offered_course_id: offeredCourseId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room_id: roomId,
        slot_type: slotType,
      },
      select: {
        id: true,
      },
    });

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      ok: true,
      slotId: slot.id,
      slotType,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add slot.";

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

type Context = {
  params: Promise<{
    slotId: string;
  }>;
};

function toMinutes(value: string) {
  const raw = String(value || "").trim();

  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;

  return Number(m[1]) * 60 + Number(m[2]);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const a1 = toMinutes(aStart);
  const a2 = toMinutes(aEnd);
  const b1 = toMinutes(bStart);
  const b2 = toMinutes(bEnd);

  if (a1 < 0 || a2 < 0 || b1 < 0 || b2 < 0) return false;
  return a1 < b2 && b1 < a2;
}

function formatRoomLabel(room: { room_code: string; room_type?: string | null } | null) {
  if (!room) return "-";
  return room.room_type ? `${room.room_type} | ${room.room_code}` : room.room_code;
}

async function validateSlotUpdate(params: {
  slotId: number;
  offeredCourseId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomId: number;
}) {
  const { slotId, offeredCourseId, dayOfWeek, startTime, endTime, roomId } = params;

  if (toMinutes(startTime) < 0 || toMinutes(endTime) < 0) {
    return "Invalid start time or end time.";
  }

  if (toMinutes(startTime) >= toMinutes(endTime)) {
    return "End time must be later than start time.";
  }

  const duplicateInSameCourse = await prisma.offered_course_slots.findFirst({
    where: {
      id: { not: slotId },
      offered_course_id: offeredCourseId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
    },
  });

  if (duplicateInSameCourse) {
    return "This course already has the same slot saved.";
  }

  const roomSlots = await prisma.offered_course_slots.findMany({
    where: {
      id: { not: slotId },
      room_id: roomId,
      day_of_week: dayOfWeek,
    },
    include: {
      offered_courses: {
        include: {
          master_courses: true,
        },
      },
    },
  });

  const roomConflict = roomSlots.find((slot) =>
    overlaps(startTime, endTime, slot.start_time, slot.end_time)
  );

  if (roomConflict) {
    return `Room conflict with ${roomConflict.offered_courses.master_courses.course_code} Section ${roomConflict.offered_courses.section}.`;
  }

  const currentCourseBatches = await prisma.offered_course_batches.findMany({
    where: {
      offered_course_id: offeredCourseId,
    },
    select: {
      batch_id: true,
    },
  });

  const currentBatchIds = new Set(currentCourseBatches.map((x) => x.batch_id));

  if (currentBatchIds.size > 0) {
    const daySlots = await prisma.offered_course_slots.findMany({
      where: {
        id: { not: slotId },
        day_of_week: dayOfWeek,
      },
      include: {
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_batches: true,
          },
        },
      },
    });

    const batchConflict = daySlots.find((slot) => {
      const sameBatch = slot.offered_courses.offered_course_batches.some((b) =>
        currentBatchIds.has(b.batch_id)
      );
      return sameBatch && overlaps(startTime, endTime, slot.start_time, slot.end_time);
    });

    if (batchConflict) {
      return `Batch conflict with ${batchConflict.offered_courses.master_courses.course_code} Section ${batchConflict.offered_courses.section}.`;
    }
  }

  return null;
}

export async function PATCH(req: NextRequest, context: Context) {
  await requireCoordinatorOrAdminApi();

  const { slotId } = await context.params;
  const parsedSlotId = Number(slotId);

  if (!Number.isFinite(parsedSlotId)) {
    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({ error: "Invalid slot id." }, { status: 400 });
  }

  const body = await req.json();

  const dayOfWeek = String(body.dayOfWeek || "").trim().toUpperCase();
  const startTime = String(body.startTime || "").trim();
  const endTime = String(body.endTime || "").trim();
  const roomId = Number(body.roomId);
  const slotType = String(body.slotType || "CLASS").trim().toUpperCase();

  const existing = await prisma.offered_course_slots.findUnique({
    where: { id: parsedSlotId },
    include: {
      rooms: true,
      offered_courses: true,
    },
  });

  if (!existing) {
    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  }

  if (existing.offered_courses.primary_offered_course_id) {
    return NextResponse.json(
      { error: "Only the primary section schedule can be edited." },
      { status: 400 }
    );
  }

  const validationError = await validateSlotUpdate({
    slotId: parsedSlotId,
    offeredCourseId: existing.offered_course_id,
    dayOfWeek,
    startTime,
    endTime,
    roomId,
  });

  if (validationError) {
    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const updated = await prisma.offered_course_slots.update({
    where: { id: parsedSlotId },
    data: {
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      room_id: roomId,
      slot_type: slotType,
    },
    include: {
      rooms: true,
    },
  });

  clearReportingCacheWithLog("offering/reporting data changed");
  return NextResponse.json({
    ok: true,
    slot: {
      id: updated.id,
      day_of_week: updated.day_of_week,
      start_time: updated.start_time,
      end_time: updated.end_time,
      room_id: updated.room_id,
      slot_type: updated.slot_type,
      room_label: formatRoomLabel(updated.rooms),
    },
  });
}

export async function DELETE(_req: NextRequest, context: Context) {
  await requireCoordinatorOrAdminApi();

  const { slotId } = await context.params;
  const parsedSlotId = Number(slotId);

  if (!Number.isFinite(parsedSlotId)) {
    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({ error: "Invalid slot id." }, { status: 400 });
  }

  const existing = await prisma.offered_course_slots.findUnique({
    where: { id: parsedSlotId },
    include: {
      offered_courses: true,
    },
  });

  if (!existing) {
    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  }

  if (existing.offered_courses.primary_offered_course_id) {
    return NextResponse.json(
      { error: "Only the primary section schedule can be edited." },
      { status: 400 }
    );
  }

  await prisma.offered_course_slots.delete({
    where: { id: parsedSlotId },
  });

  clearReportingCacheWithLog("offering/reporting data changed");
  return NextResponse.json({
    ok: true,
    success: true,
  });
}
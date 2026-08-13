import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getSectionGroupBatchIds,
  getSectionGroupCourseIds,
} from "@/lib/offering-section-group";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";
import { SCHEDULE_CONFLICT_STATUSES } from "@/lib/course-schedule-policy";

type Context = {
  params: Promise<{
    slotId: string;
  }>;
};

function toMinutes(value: string) {
  const raw = String(value || "").trim();

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return -1;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return -1;
  }

  return hour * 60 + minute;
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  const a1 = toMinutes(aStart);
  const a2 = toMinutes(aEnd);
  const b1 = toMinutes(bStart);
  const b2 = toMinutes(bEnd);

  if (
    a1 < 0 ||
    a2 < 0 ||
    b1 < 0 ||
    b2 < 0
  ) {
    return false;
  }

  return a1 < b2 && b1 < a2;
}

function formatRoomLabel(
  room: {
    room_code: string;
    room_type?: string | null;
  } | null
) {
  if (!room) {
    return "-";
  }

  return room.room_type
    ? `${room.room_type} | ${room.room_code}`
    : room.room_code;
}

async function validateSlotUpdate(params: {
  slotId: number;
  offeredCourseId: number;
  academicTermId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomId: number;
}) {
  const {
    slotId,
    offeredCourseId,
    academicTermId,
    dayOfWeek,
    startTime,
    endTime,
    roomId,
  } = params;

  if (
    toMinutes(startTime) < 0 ||
    toMinutes(endTime) < 0
  ) {
    return "Invalid start time or end time.";
  }

  if (
    toMinutes(startTime) >=
    toMinutes(endTime)
  ) {
    return "End time must be later than start time.";
  }

  /*
   * A primary and all of its co-offered secondary rows represent
   * one operational teaching event.
   *
   * They must not conflict with one another.
   */
  const groupCourseIds =
    await prisma.$transaction((tx) =>
      getSectionGroupCourseIds(
        tx,
        offeredCourseId
      )
    );

  const batchIds =
    await prisma.$transaction((tx) =>
      getSectionGroupBatchIds(
        tx,
        offeredCourseId
      )
    );

  /*
   * Prevent an exact duplicate slot within the operational
   * section group, excluding the slot currently being edited.
   */
  const duplicateInSameGroup =
    await prisma.offered_course_slots.findFirst({
      where: {
        id: {
          not: slotId,
        },

        offered_course_id: {
          in: groupCourseIds,
        },

        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
      },

      select: {
        id: true,
      },
    });

  if (duplicateInSameGroup) {
    return "This teaching section already has the same slot saved.";
  }

  /*
   * ROOM CONFLICT
   *
   * Critical rule:
   * only offerings from the SAME academic term can conflict.
   *
   * Historical semesters must never block editing of the
   * current semester.
   */
  const roomSlots =
    await prisma.offered_course_slots.findMany({
      where: {
        id: {
          not: slotId,
        },

        room_id: roomId,

        day_of_week:
          dayOfWeek,

        offered_course_id: {
          notIn:
            groupCourseIds,
        },

        offered_courses: {
          offerings: {
            academic_term_id:
              academicTermId,

            status: {
              in: SCHEDULE_CONFLICT_STATUSES,
            },
          },
        },
      },

      include: {
        offered_courses: {
          include: {
            master_courses:
              true,
          },
        },
      },
    });

  const roomConflict =
    roomSlots.find((slot) =>
      overlaps(
        startTime,
        endTime,
        slot.start_time,
        slot.end_time
      )
    );

  if (roomConflict) {
    return `Room conflict with ${roomConflict.offered_courses.master_courses.course_code} Section ${roomConflict.offered_courses.section}.`;
  }

  /*
   * BATCH CONFLICT
   *
   * Only courses belonging to the same academic term and valid
   * scheduling lifecycle statuses are considered.
   *
   * This is the fix for historical offerings incorrectly
   * blocking current-semester schedule edits.
   */
  if (batchIds.length > 0) {
    const daySlots =
      await prisma.offered_course_slots.findMany({
        where: {
          id: {
            not: slotId,
          },

          day_of_week:
            dayOfWeek,

          offered_course_id: {
            notIn:
              groupCourseIds,
          },

          offered_courses: {
            offerings: {
              academic_term_id:
                academicTermId,

              status: {
                in: SCHEDULE_CONFLICT_STATUSES,
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

        include: {
          offered_courses: {
            include: {
              master_courses:
                true,

              offered_course_batches:
                true,
            },
          },
        },
      });

    const batchConflict =
      daySlots.find((slot) =>
        overlaps(
          startTime,
          endTime,
          slot.start_time,
          slot.end_time
        )
      );

    if (batchConflict) {
      return `Batch conflict with ${batchConflict.offered_courses.master_courses.course_code} Section ${batchConflict.offered_courses.section}.`;
    }
  }

  return null;
}

export async function PATCH(
  req: NextRequest,
  context: Context
) {
  await requireCoordinatorOrAdminApi();

  const { slotId } =
    await context.params;

  const parsedSlotId =
    Number(slotId);

  if (
    !Number.isInteger(parsedSlotId) ||
    parsedSlotId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid slot id.",
      },
      {
        status: 400,
      }
    );
  }

  const body =
    await req.json();

  const dayOfWeek =
    String(
      body.dayOfWeek || ""
    )
      .trim()
      .toUpperCase();

  const startTime =
    String(
      body.startTime || ""
    ).trim();

  const endTime =
    String(
      body.endTime || ""
    ).trim();

  const roomId =
    Number(body.roomId);

  const slotType =
    String(
      body.slotType ||
        "CLASS"
    )
      .trim()
      .toUpperCase();

  if (
    !Number.isInteger(roomId) ||
    roomId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Valid room is required.",
      },
      {
        status: 400,
      }
    );
  }

  const existing =
    await prisma.offered_course_slots.findUnique({
      where: {
        id: parsedSlotId,
      },

      include: {
        rooms: true,

        offered_courses: {
          include: {
            offerings: {
              select: {
                id: true,
                academic_term_id:
                  true,
                status: true,
              },
            },
          },
        },
      },
    });

  if (!existing) {
    return NextResponse.json(
      {
        error:
          "Slot not found.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    existing.offered_courses
      .primary_offered_course_id
  ) {
    return NextResponse.json(
      {
        error:
          "Only the primary section schedule can be edited.",
      },
      {
        status: 400,
      }
    );
  }

  const validationError =
    await validateSlotUpdate({
      slotId:
        parsedSlotId,

      offeredCourseId:
        existing.offered_course_id,

      academicTermId:
        existing.offered_courses
          .offerings
          .academic_term_id,

      dayOfWeek,
      startTime,
      endTime,
      roomId,
    });

  if (validationError) {
    return NextResponse.json(
      {
        error:
          validationError,
      },
      {
        status: 400,
      }
    );
  }

  const updated =
    await prisma.offered_course_slots.update({
      where: {
        id: parsedSlotId,
      },

      data: {
        day_of_week:
          dayOfWeek,

        start_time:
          startTime,

        end_time:
          endTime,

        room_id:
          roomId,

        slot_type:
          slotType,
      },

      include: {
        rooms: true,
      },
    });

  clearReportingCacheWithLog(
    "offering/reporting data changed"
  );

  return NextResponse.json({
    ok: true,

    slot: {
      id:
        updated.id,

      day_of_week:
        updated.day_of_week,

      start_time:
        updated.start_time,

      end_time:
        updated.end_time,

      room_id:
        updated.room_id,

      slot_type:
        updated.slot_type,

      room_label:
        formatRoomLabel(
          updated.rooms
        ),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  context: Context
) {
  await requireCoordinatorOrAdminApi();

  const { slotId } =
    await context.params;

  const parsedSlotId =
    Number(slotId);

  if (
    !Number.isInteger(parsedSlotId) ||
    parsedSlotId <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid slot id.",
      },
      {
        status: 400,
      }
    );
  }

  const existing =
    await prisma.offered_course_slots.findUnique({
      where: {
        id: parsedSlotId,
      },

      include: {
        offered_courses:
          true,
      },
    });

  if (!existing) {
    return NextResponse.json(
      {
        error:
          "Slot not found.",
      },
      {
        status: 404,
      }
    );
  }

  if (
    existing.offered_courses
      .primary_offered_course_id
  ) {
    return NextResponse.json(
      {
        error:
          "Only the primary section schedule can be edited.",
      },
      {
        status: 400,
      }
    );
  }

  await prisma.offered_course_slots.delete({
    where: {
      id:
        parsedSlotId,
    },
  });

  clearReportingCacheWithLog(
    "offering/reporting data changed"
  );

  return NextResponse.json({
    ok: true,
    success: true,
  });
}
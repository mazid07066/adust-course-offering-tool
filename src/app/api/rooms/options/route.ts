import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { SCHEDULE_CONFLICT_STATUSES } from "@/lib/course-schedule-policy";

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function parseOptionalPositiveInteger(
  value: string | null
) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function splitStoredRoomCode(
  stored: string
) {
  const raw =
    String(stored || "").trim();

  const parts =
    raw
      .split("|")
      .map((item) =>
        item.trim()
      );

  if (parts.length >= 2) {
    return {
      roomCode:
        parts[0],

      roomNumber:
        parts
          .slice(1)
          .join(" | "),
    };
  }

  return {
    roomCode:
      raw,

    roomNumber:
      "",
  };
}

export async function GET(
  req: NextRequest
) {
  try {
    await requireCoordinatorOrAdminApi();

    const { searchParams } =
      new URL(req.url);

    const dayOfWeek =
      String(
        searchParams.get(
          "dayOfWeek"
        ) || ""
      )
        .trim()
        .toUpperCase();

    const startTime =
      String(
        searchParams.get(
          "startTime"
        ) || ""
      ).trim();

    const endTime =
      String(
        searchParams.get(
          "endTime"
        ) || ""
      ).trim();

    const offeredCourseId =
      parseOptionalPositiveInteger(
        searchParams.get(
          "offeredCourseId"
        )
      );

    const excludeSlotId =
      parseOptionalPositiveInteger(
        searchParams.get(
          "excludeSlotId"
        )
      );

    const shouldFilterBySlot =
      Boolean(dayOfWeek) &&
      Boolean(startTime) &&
      Boolean(endTime);

    if (
      shouldFilterBySlot &&
      (
        !isValidTime(startTime) ||
        !isValidTime(endTime) ||
        startTime >= endTime
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid day/time filter.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Resolve the academic term from the offered course.
     *
     * This prevents a room occupied in an old semester from
     * disappearing from the current semester's room list.
     */
    let academicTermId:
      number | null = null;

    if (offeredCourseId) {
      const offeredCourse =
        await prisma.offered_courses.findUnique({
          where: {
            id:
              offeredCourseId,
          },

          select: {
            offerings: {
              select: {
                academic_term_id:
                  true,
              },
            },
          },
        });

      if (!offeredCourse) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Offered course not found.",
          },
          {
            status: 404,
          }
        );
      }

      academicTermId =
        offeredCourse
          .offerings
          .academic_term_id;
    }

    /*
     * If an edit request gives only the existing slot ID,
     * resolve the term from that slot as a safe fallback.
     */
    if (
      !academicTermId &&
      excludeSlotId
    ) {
      const existingSlot =
        await prisma.offered_course_slots.findUnique({
          where: {
            id:
              excludeSlotId,
          },

          select: {
            offered_courses: {
              select: {
                offerings: {
                  select: {
                    academic_term_id:
                      true,
                  },
                },
              },
            },
          },
        });

      academicTermId =
        existingSlot
          ?.offered_courses
          .offerings
          .academic_term_id ??
        null;
    }

    const rooms =
      await prisma.rooms.findMany({
        where:
          shouldFilterBySlot
            ? {
                is_active:
                  true,

                NOT: {
                  offered_course_slots: {
                    some: {
                      /*
                       * Critical edit fix:
                       *
                       * Do not treat the slot currently being edited
                       * as a conflict with its own room.
                       */
                      ...(excludeSlotId
                        ? {
                            id: {
                              not:
                                excludeSlotId,
                            },
                          }
                        : {}),

                      day_of_week:
                        dayOfWeek,

                      start_time: {
                        lt:
                          endTime,
                      },

                      end_time: {
                        gt:
                          startTime,
                      },

                      offered_courses: {
                        offerings: {
                          ...(academicTermId
                            ? {
                                academic_term_id:
                                  academicTermId,
                              }
                            : {}),

                          status: {
                            in:
                              SCHEDULE_CONFLICT_STATUSES,
                          },
                        },
                      },
                    },
                  },
                },
              }
            : {
                is_active:
                  true,
              },

        orderBy: {
          room_code:
            "asc",
        },

        select: {
          id:
            true,

          room_code:
            true,

          room_type:
            true,
        },
      });

    return NextResponse.json({
      ok: true,

      rooms:
        rooms.map(
          (room) => {
            const parsed =
              splitStoredRoomCode(
                room.room_code
              );

            return {
              id:
                room.id,

              room_code:
                room.room_code,

              room_type:
                room.room_type,

              roomCode:
                `${parsed.roomCode}${
                  parsed.roomNumber
                    ? ` | ${parsed.roomNumber}`
                    : ""
                } | ${room.room_type}`,
            };
          }
        ),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load room options.";

    console.error(
      "Room options load error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          message,
      },
      {
        status: 500,
      }
    );
  }
}

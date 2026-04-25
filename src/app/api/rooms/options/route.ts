import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { SCHEDULE_CONFLICT_STATUSES } from "@/lib/course-schedule-policy";

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function splitStoredRoomCode(stored: string) {
  const raw = String(stored || "").trim();
  const parts = raw.split("|").map((x) => x.trim());

  if (parts.length >= 2) {
    return {
      roomCode: parts[0],
      roomNumber: parts.slice(1).join(" | "),
    };
  }

  return {
    roomCode: raw,
    roomNumber: "",
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const { searchParams } = new URL(req.url);
    const dayOfWeek = String(searchParams.get("dayOfWeek") || "")
      .trim()
      .toUpperCase();
    const startTime = String(searchParams.get("startTime") || "").trim();
    const endTime = String(searchParams.get("endTime") || "").trim();

    const shouldFilterBySlot =
      Boolean(dayOfWeek) && Boolean(startTime) && Boolean(endTime);

    if (
      shouldFilterBySlot &&
      (!isValidTime(startTime) || !isValidTime(endTime) || startTime >= endTime)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid day/time filter.",
        },
        { status: 400 }
      );
    }

    const rooms = await prisma.rooms.findMany({
      where: shouldFilterBySlot
        ? {
            is_active: true,
            NOT: {
              offered_course_slots: {
                some: {
                  day_of_week: dayOfWeek,
                  start_time: {
                    lt: endTime,
                  },
                  end_time: {
                    gt: startTime,
                  },
                  offered_courses: {
                    offerings: {
                      status: {
                        in: SCHEDULE_CONFLICT_STATUSES,
                      },
                    },
                  },
                },
              },
            },
          }
        : {
            is_active: true,
          },
      orderBy: {
        room_code: "asc",
      },
      select: {
        id: true,
        room_code: true,
        room_type: true,
      },
    });

    return NextResponse.json({
      ok: true,
      rooms: rooms.map((room) => {
        const parsed = splitStoredRoomCode(room.room_code);
        return {
          id: room.id,
          room_code: room.room_code,
          room_type: room.room_type,
          roomCode: `${parsed.roomCode}${parsed.roomNumber ? ` | ${parsed.roomNumber}` : ""} | ${room.room_type}`,
        };
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load room options.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

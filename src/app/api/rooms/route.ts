import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function buildStoredRoomCode(roomCode: string, roomNumber: string) {
  const code = String(roomCode || "").trim().toUpperCase();
  const number = String(roomNumber || "").trim().toUpperCase();

  if (!code || !number) {
    throw new Error("roomCode and roomNumber are required.");
  }

  return `${code} | ${number}`;
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

function parseCapacity(value: unknown) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Room capacity must be a positive whole number.");
  }

  return parsed;
}

export async function GET() {
  try {
    await requireCoordinatorOrAdminApi();

    const rooms = await prisma.rooms.findMany({
      orderBy: {
        room_code: "asc",
      },
      select: {
        id: true,
        room_code: true,
        room_type: true,
        capacity: true,
        is_active: true,
      },
    });

    return NextResponse.json({
      ok: true,
      rooms: rooms.map((room) => {
        const parsed = splitStoredRoomCode(room.room_code);

        return {
          id: room.id,
          roomCode: parsed.roomCode,
          roomNumber: parsed.roomNumber,
          building: room.room_type,
          capacity: room.capacity,
          isActive: Boolean(room.is_active),
          displayCode: `${parsed.roomCode} | ${parsed.roomNumber}`,
        };
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load rooms.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireCoordinatorOrAdminApi();

    const body = await req.json();

    const roomCode = String(body.roomCode || "").trim().toUpperCase();
    const roomNumber = String(body.roomNumber || "").trim().toUpperCase();
    const building = String(body.building || "").trim().toUpperCase();
    const capacity = parseCapacity(body.capacity);
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

    if (!roomCode) {
      return NextResponse.json(
        {
          ok: false,
          error: "Room code is required.",
        },
        { status: 400 }
      );
    }

    if (!roomNumber) {
      return NextResponse.json(
        {
          ok: false,
          error: "Room number is required.",
        },
        { status: 400 }
      );
    }

    if (!["BUILDING 1", "BUILDING 2", "BUILDING 3"].includes(building)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Building must be one of BUILDING 1, BUILDING 2, BUILDING 3.",
        },
        { status: 400 }
      );
    }

    const storedRoomCode = buildStoredRoomCode(roomCode, roomNumber);

    const existing = await prisma.rooms.findFirst({
      where: {
        room_code: storedRoomCode,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "This room code and room number combination already exists.",
        },
        { status: 400 }
      );
    }

    const room = await prisma.rooms.create({
      data: {
        room_code: storedRoomCode,
        room_type: building,
        capacity,
        is_active: isActive,
      },
      select: {
        id: true,
        room_code: true,
        room_type: true,
        capacity: true,
        is_active: true,
      },
    });

    const parsed = splitStoredRoomCode(room.room_code);

    return NextResponse.json({
      ok: true,
      room: {
        id: room.id,
        roomCode: parsed.roomCode,
        roomNumber: parsed.roomNumber,
        building: room.room_type,
        capacity: room.capacity,
        isActive: Boolean(room.is_active),
        displayCode: `${parsed.roomCode} | ${parsed.roomNumber}`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create room.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
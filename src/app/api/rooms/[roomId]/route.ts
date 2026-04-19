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

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    await requireCoordinatorOrAdminApi();

    const params = await context.params;
    const roomId = Number(params.roomId);

    if (!Number.isFinite(roomId) || roomId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Valid roomId is required.",
        },
        { status: 400 }
      );
    }

    const body = await req.json();

    const roomCode = String(body.roomCode || "").trim().toUpperCase();
    const roomNumber = String(body.roomNumber || "").trim().toUpperCase();
    const building = String(body.building || "").trim().toUpperCase();
    const isActive = Boolean(body.isActive);

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

    const duplicate = await prisma.rooms.findFirst({
      where: {
        room_code: storedRoomCode,
        NOT: {
          id: roomId,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error: "Another room already uses this room code and room number combination.",
        },
        { status: 400 }
      );
    }

    const updated = await prisma.rooms.update({
      where: {
        id: roomId,
      },
      data: {
        room_code: storedRoomCode,
        room_type: building,
        is_active: isActive,
      },
      select: {
        id: true,
        room_code: true,
        room_type: true,
        is_active: true,
      },
    });

    const parsed = splitStoredRoomCode(updated.room_code);

    return NextResponse.json({
      ok: true,
      room: {
        id: updated.id,
        roomCode: parsed.roomCode,
        roomNumber: parsed.roomNumber,
        building: updated.room_type,
        isActive: Boolean(updated.is_active),
        displayCode: `${parsed.roomCode} | ${parsed.roomNumber}`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update room.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    await requireCoordinatorOrAdminApi();

    const params = await context.params;
    const roomId = Number(params.roomId);

    if (!Number.isFinite(roomId) || roomId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Valid roomId is required.",
        },
        { status: 400 }
      );
    }

    const usageCount = await prisma.offered_course_slots.count({
      where: {
        room_id: roomId,
      },
    });

    if (usageCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This room is already used in scheduled slots. Set it inactive instead of deleting.",
        },
        { status: 400 }
      );
    }

    await prisma.rooms.delete({
      where: {
        id: roomId,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Room deleted successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete room.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
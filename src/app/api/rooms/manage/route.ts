import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  await requireCoordinatorOrAdminApi();

  try {
    const rooms = await prisma.rooms.findMany({
      orderBy: { room_code: "asc" },
    });

    return NextResponse.json({
      success: true,
      rooms,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load rooms",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await request.json();

    const {
      room_code,
      room_type,
      capacity,
    }: {
      room_code: string;
      room_type: string;
      capacity?: number | null;
    } = body;

    if (!room_code || !room_type) {
      return NextResponse.json(
        { error: "room_code and room_type are required" },
        { status: 400 }
      );
    }

    const created = await prisma.rooms.create({
      data: {
        room_code: room_code.trim().toUpperCase(),
        room_type: room_type.trim().toUpperCase(),
        capacity: capacity || null,
        is_active: true,
      },
    });

    return NextResponse.json({
      success: true,
      room: created,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create room",
      },
      { status: 500 }
    );
  }
}
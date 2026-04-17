import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireSuperAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const rooms = await prisma.room.findMany({
      include: {
        department: true,
      },
      orderBy: {
        roomCode: "asc",
      },
    });

    const departments = await prisma.department.findMany({
      orderBy: { code: "asc" },
    });

    return NextResponse.json({
      success: true,
      rooms,
      departments,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load rooms." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();

    const {
      roomCode,
      capacity,
      departmentCode,
    } = body as {
      roomCode: string;
      capacity?: number;
      departmentCode?: string;
    };

    if (!roomCode) {
      return NextResponse.json(
        { error: "roomCode is required." },
        { status: 400 }
      );
    }

    let departmentId: string | null = null;

    if (departmentCode) {
      const department = await prisma.department.findUnique({
        where: {
          code: departmentCode.trim().toUpperCase(),
        },
      });

      if (!department) {
        return NextResponse.json(
          { error: "Department not found." },
          { status: 404 }
        );
      }

      departmentId = department.id;
    }

    const room = await prisma.room.upsert({
      where: {
        roomCode: roomCode.trim().toUpperCase(),
      },
      update: {
        capacity: capacity ? Number(capacity) : null,
        departmentId,
        isActive: true,
      },
      create: {
        roomCode: roomCode.trim().toUpperCase(),
        capacity: capacity ? Number(capacity) : null,
        departmentId,
        isActive: true,
      },
      include: {
        department: true,
      },
    });

    return NextResponse.json({
      success: true,
      room,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save room." },
      { status: 500 }
    );
  }
}
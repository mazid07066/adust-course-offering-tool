import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const [programs, terms, rooms] = await Promise.all([
      prisma.programs.findMany({
        orderBy: [{ short_name: "asc" }],
        select: {
          id: true,
          short_name: true,
          name: true,
        },
      }),

      prisma.academic_terms.findMany({
        orderBy: [{ id: "desc" }],
        select: {
          id: true,
          name: true,
        },
      }),

      prisma.rooms.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ room_code: "asc" }],
        select: {
          id: true,
          room_code: true,
          room_type: true,
          capacity: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      programs,
      terms,
      rooms,
    });
  } catch (error) {
    console.error("Exam scheduler options error:", error);
    return NextResponse.json(
      { error: "Failed to load exam scheduler options." },
      { status: 500 }
    );
  }
}
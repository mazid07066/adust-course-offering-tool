import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const data = await prisma.departments.findMany({
    include: {
      programs: {
        include: {
          master_courses: true,
        },
      },
    },
  });

  return NextResponse.json(data);
}
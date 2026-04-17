import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const terms = await prisma.academic_terms.findMany({
    orderBy: { year: "desc" },
  });

  return NextResponse.json({ terms });
}
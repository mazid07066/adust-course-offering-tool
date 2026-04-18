import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type BatchRow = {
  id: number;
  batch_code: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const programCode = (searchParams.get("programCode") || "").trim().toUpperCase();

  if (!programCode) {
    return NextResponse.json({ batches: [] });
  }

  const program = await prisma.programs.findFirst({
    where: {
      OR: [{ short_name: programCode }, { code: programCode }],
    },
  });

  if (!program) {
    return NextResponse.json({ batches: [] });
  }

  const batches = (await prisma.batches.findMany({
    where: {
      program_id: program.id,
    },
    orderBy: {
      batch_code: "asc",
    },
    select: {
      id: true,
      batch_code: true,
    },
  })) as BatchRow[];

  return NextResponse.json({
    batches: batches.map((b: BatchRow) => ({
      id: b.id,
      batchCode: b.batch_code,
      label: b.batch_code,
    })),
  });
}
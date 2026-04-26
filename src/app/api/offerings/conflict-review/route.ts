import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { analyzeOfferingConflicts, OfferingRowInput } from "@/lib/offering-conflicts";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

function parseAcademicTerm(termName: string) {
  const match = termName.trim().toUpperCase().match(/^(SPRING|SUMMER|FALL)\s+(\d{4})$/);

  if (!match) {
    throw new Error(`Invalid academic term format: ${termName}`);
  }

  return {
    season: match[1],
    year: Number(match[2]),
  };
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await request.json();

    const {
      suggested_term_name,
      rows,
    }: {
      suggested_term_name: string;
      rows: OfferingRowInput[];
    } = body;

    if (!suggested_term_name || !Array.isArray(rows)) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { error: "suggested_term_name and rows are required" },
        { status: 400 }
      );
    }

    let term = await prisma.academic_terms.findFirst({
      where: { name: suggested_term_name },
    });

    if (!term) {
      const parsed = parseAcademicTerm(suggested_term_name);

      term = await prisma.academic_terms.create({
        data: {
          name: suggested_term_name,
          year: parsed.year,
          term_type: parsed.season,
          is_active: true,
        },
      });
    }

    const result = await analyzeOfferingConflicts(term.id, rows);

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(error);

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to review conflicts",
      },
      { status: 500 }
    );
  }
}
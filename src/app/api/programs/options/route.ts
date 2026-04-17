import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function parseVariantFromCode(code: string) {
  const upper = code.toUpperCase().trim();

  if (upper.includes("-REG")) return "REG";
  if (upper.includes("-EVE")) return "EVE";
  if (upper.includes("-ACC")) return "ACC";
  if (upper.includes("-OTH")) return "OTH";

  return "NONE";
}

function parseSchemeFromCode(code: string) {
  const upper = code.toUpperCase().trim();

  if (upper.endsWith("-OLD")) return "OLD";
  if (upper.endsWith("-NEW")) return "NEW";

  return "NONE";
}

function getBaseCode(code: string) {
  return code
    .toUpperCase()
    .trim()
    .replace(/-(REG|EVE|ACC|OTH)/i, "")
    .replace(/-(OLD|NEW)$/i, "");
}

function getVariantLabel(variant: string) {
  switch (variant) {
    case "REG":
      return "Regular";
    case "EVE":
      return "Evening";
    case "ACC":
      return "Accelerated";
    case "OTH":
      return "Other";
    default:
      return "";
  }
}

function getSchemeLabel(scheme: string) {
  switch (scheme) {
    case "OLD":
      return "Old Curriculum";
    case "NEW":
      return "New Curriculum";
    default:
      return "";
  }
}

export async function GET() {
  await requireCoordinatorOrAdminApi();

  try {
    const programs = await prisma.programs.findMany({
      include: {
        master_courses: true,
      },
      orderBy: [{ short_name: "asc" }],
    });

    const filtered = programs
      .filter((p) => p.master_courses.length > 0)
      .map((p) => {
        const variant = parseVariantFromCode(p.short_name);
        const scheme = parseSchemeFromCode(p.short_name);
        const baseCode = getBaseCode(p.short_name);

        const pieces = [
          getVariantLabel(variant),
          getSchemeLabel(scheme),
        ].filter(Boolean);

        return {
          id: p.id,
          code: p.short_name,
          baseCode,
          variant,
          variantLabel: getVariantLabel(variant),
          scheme,
          schemeLabel: getSchemeLabel(scheme),
          name: p.name,
          courseCount: p.master_courses.length,
          label:
            pieces.length > 0
              ? `${p.short_name} — ${p.name} [${pieces.join(" | ")}]`
              : `${p.short_name} — ${p.name}`,
        };
      });

    return NextResponse.json({
      success: true,
      programs: filtered,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load program options.",
      },
      { status: 500 }
    );
  }
}
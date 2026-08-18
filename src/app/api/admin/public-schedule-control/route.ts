import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getPublicScheduleSettings,
  setPublicScheduleSettings,
} from "@/lib/public-schedule-settings";

function parsePositiveInteger(
  value: unknown
): number | null {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const [settings, terms] = await Promise.all([
      getPublicScheduleSettings(),
      prisma.academic_terms.findMany({
        select: {
          id: true,
          name: true,
          year: true,
          term_type: true,
          is_active: true,
          is_current: true,
        },
        orderBy: [
          {
            year: "desc",
          },
          {
            id: "desc",
          },
        ],
      }),
    ]);

    const selectedTerm =
      settings.academicTermId
        ? terms.find(
            (term) =>
              term.id === settings.academicTermId
          ) ?? null
        : null;

    return NextResponse.json({
      success: true,
      settings: {
        enabled: settings.enabled,
        academicTermId:
          settings.academicTermId,
      },
      selectedTerm,
      terms,
    });
  } catch (error) {
    console.error(
      "Public schedule control load failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load public schedule control.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const body = await req.json();

    const enabled = body?.enabled === true;
    const academicTermId =
      parsePositiveInteger(body?.academicTermId);

    if (enabled && !academicTermId) {
      return NextResponse.json(
        {
          error:
            "Select an academic term before opening the public schedule.",
        },
        {
          status: 400,
        }
      );
    }

    let selectedTerm: {
      id: number;
      name: string;
      year: number;
      term_type: string;
    } | null = null;

    if (academicTermId) {
      selectedTerm =
        await prisma.academic_terms.findUnique({
          where: {
            id: academicTermId,
          },
          select: {
            id: true,
            name: true,
            year: true,
            term_type: true,
          },
        });

      if (!selectedTerm) {
        return NextResponse.json(
          {
            error: "Academic term not found.",
          },
          {
            status: 404,
          }
        );
      }
    }

    await setPublicScheduleSettings({
      enabled,
      academicTermId,
      userId: Number(guard.id),
    });

    return NextResponse.json({
      success: true,
      message: enabled
        ? `Public schedule opened for ${selectedTerm?.name || "selected term"}.`
        : "Public schedule closed successfully.",
      settings: {
        enabled,
        academicTermId,
      },
      selectedTerm,
    });
  } catch (error) {
    console.error(
      "Public schedule control update failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update public schedule control.",
      },
      {
        status: 500,
      }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function parsePositiveInteger(value: unknown, label: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function parseDisplayOrder(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const moduleCode = String(searchParams.get("moduleCode") || "")
      .trim()
      .toUpperCase();

    const groups = moduleCode
      ? await prisma.$queryRaw<
          Array<{
            id: number;
            module_id: number;
            module_code: string;
            module_title: string;
            group_code: string;
            group_title: string;
            description: string | null;
            display_order: number;
            is_active: boolean;
          }>
        >`
          SELECT
            g.id,
            g.module_id,
            m.module_code,
            m.module_title,
            g.group_code,
            g.group_title,
            g.description,
            g.display_order,
            g.is_active
          FROM baete_task_groups g
          JOIN baete_workspace_modules m ON m.id = g.module_id
          WHERE m.module_code = ${moduleCode}
          ORDER BY g.is_active DESC, m.display_order ASC, g.display_order ASC;
        `
      : await prisma.$queryRaw<
          Array<{
            id: number;
            module_id: number;
            module_code: string;
            module_title: string;
            group_code: string;
            group_title: string;
            description: string | null;
            display_order: number;
            is_active: boolean;
          }>
        >`
          SELECT
            g.id,
            g.module_id,
            m.module_code,
            m.module_title,
            g.group_code,
            g.group_title,
            g.description,
            g.display_order,
            g.is_active
          FROM baete_task_groups g
          JOIN baete_workspace_modules m ON m.id = g.module_id
          ORDER BY g.is_active DESC, m.display_order ASC, g.display_order ASC;
        `;

    const modules = await prisma.$queryRaw<
      Array<{
        id: number;
        module_code: string;
        module_title: string;
      }>
    >`
      SELECT id, module_code, module_title
      FROM baete_workspace_modules
      WHERE is_active = TRUE
      ORDER BY display_order ASC, module_title ASC;
    `;

    return NextResponse.json({
      success: true,
      groups,
      modules,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load task groups.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const moduleId = parsePositiveInteger(body.module_id, "module_id");

    const groupCode = String(body.group_code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    const groupTitle = String(body.group_title || "").trim();
    const description = String(body.description || "").trim() || null;
    const displayOrder = parseDisplayOrder(body.display_order);

    if (!groupCode) {
      return NextResponse.json(
        { error: "Group code is required." },
        { status: 400 }
      );
    }

    if (!groupTitle) {
      return NextResponse.json(
        { error: "Group title is required." },
        { status: 400 }
      );
    }

    const moduleRows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM baete_workspace_modules
      WHERE id = ${moduleId}
        AND is_active = TRUE
      LIMIT 1;
    `;

    if (!moduleRows[0]) {
      return NextResponse.json(
        { error: "Module not found." },
        { status: 404 }
      );
    }

    const duplicate = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM baete_task_groups
      WHERE module_id = ${moduleId}
        AND group_code = ${groupCode}
      LIMIT 1;
    `;

    if (duplicate[0]) {
      return NextResponse.json(
        { error: "This group code already exists under the selected module." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO baete_task_groups (
        module_id,
        group_code,
        group_title,
        description,
        display_order,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        ${moduleId},
        ${groupCode},
        ${groupTitle},
        ${description},
        ${displayOrder},
        TRUE,
        NOW(),
        NOW()
      );
    `;

    return NextResponse.json({
      success: true,
      message: "Task group created successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create task group.",
      },
      { status: 500 }
    );
  }
}

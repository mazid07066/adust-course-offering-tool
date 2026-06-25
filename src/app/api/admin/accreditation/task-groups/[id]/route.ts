import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function parseId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid task group id.");
  }

  return id;
}

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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const taskGroupId = parseId(id);
    const body = await req.json();

    const moduleId = parsePositiveInteger(body.module_id, "module_id");

    const groupCode = String(body.group_code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    const groupTitle = String(body.group_title || "").trim();
    const description = String(body.description || "").trim() || null;
    const displayOrder = parseDisplayOrder(body.display_order);
    const isActive =
      typeof body.is_active === "boolean" ? body.is_active : true;

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

    const duplicate = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM baete_task_groups
      WHERE module_id = ${moduleId}
        AND group_code = ${groupCode}
        AND id <> ${taskGroupId}
      LIMIT 1;
    `;

    if (duplicate[0]) {
      return NextResponse.json(
        { error: "Another group already uses this code in the selected module." },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE baete_task_groups
      SET
        module_id = ${moduleId},
        group_code = ${groupCode},
        group_title = ${groupTitle},
        description = ${description},
        display_order = ${displayOrder},
        is_active = ${isActive},
        updated_at = NOW()
      WHERE id = ${taskGroupId};
    `;

    return NextResponse.json({
      success: true,
      message: "Task group updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update task group.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const taskGroupId = parseId(id);

    await prisma.$executeRaw`
      UPDATE baete_task_groups
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = ${taskGroupId};
    `;

    return NextResponse.json({
      success: true,
      message: "Task group archived successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to archive task group.",
      },
      { status: 500 }
    );
  }
}
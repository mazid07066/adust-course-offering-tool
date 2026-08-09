import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function normalizeNullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeRequiredString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeTeacherCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const guard =
    await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const { id } =
      await context.params;

    const facultyId =
      parsePositiveInteger(id);

    if (!facultyId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid faculty id.",
        },
        {
          status: 400,
        }
      );
    }

    const existing =
      await prisma.teachers.findUnique({
        where: {
          id: facultyId,
        },
        select: {
          id: true,
          teacher_code: true,
          department_id: true,
          full_name: true,
          is_active: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faculty record was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json();

    const teacher_code =
      body.teacher_code === undefined
        ? undefined
        : normalizeTeacherCode(
            body.teacher_code
          );

    const parsedDepartmentId =
      body.department_id === undefined
        ? undefined
        : parsePositiveInteger(
            body.department_id
          );

    const department_id:
      number | undefined =
      parsedDepartmentId === null
        ? undefined
        : parsedDepartmentId;

    const full_name =
      body.full_name === undefined
        ? undefined
        : normalizeRequiredString(
            body.full_name
          );

    const designation =
      body.designation === undefined
        ? undefined
        : normalizeNullableString(
            body.designation
          );

    const email =
      body.email === undefined
        ? undefined
        : normalizeNullableString(
            body.email
          );

    const phone =
      body.phone === undefined
        ? undefined
        : normalizeNullableString(
            body.phone
          );

    const is_active =
      typeof body.is_active ===
      "boolean"
        ? body.is_active
        : undefined;

    const seniority_level =
      body.seniority_level ===
      undefined
        ? undefined
        : body.seniority_level ===
              "" ||
            body.seniority_level ===
              null
          ? null
          : Number(
              body.seniority_level
            );

    if (
      teacher_code !==
        undefined &&
      !teacher_code
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faculty code cannot be empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      body.department_id !==
        undefined &&
      parsedDepartmentId === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid department is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      full_name !== undefined &&
      !full_name
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faculty full name cannot be empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      seniority_level !==
        undefined &&
      seniority_level !== null &&
      (
        !Number.isInteger(
          seniority_level
        ) ||
        seniority_level < 1 ||
        seniority_level > 20
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Seniority level must be an integer between 1 and 20.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      department_id !==
      undefined
    ) {
      const department =
        await prisma.departments.findUnique({
          where: {
            id: department_id,
          },
          select: {
            id: true,
          },
        });

      if (!department) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Selected department was not found.",
          },
          {
            status: 404,
          }
        );
      }
    }

    if (
      teacher_code !==
        undefined &&
      teacher_code !==
        existing.teacher_code
    ) {
      const duplicate =
        await prisma.teachers.findUnique({
          where: {
            teacher_code,
          },
          select: {
            id: true,
          },
        });

      if (
        duplicate &&
        duplicate.id !==
          facultyId
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Faculty code ${teacher_code} is already used by another faculty.`,
          },
          {
            status: 409,
          }
        );
      }
    }

    const updated =
      await prisma.teachers.update({
        where: {
          id: facultyId,
        },
        data: {
          teacher_code,
          department_id,
          full_name,
          designation,
          email,
          phone,
          seniority_level,
          is_active,
        },
        include: {
          departments: true,
        },
      });

    return NextResponse.json({
      success: true,
      faculty: updated,
      message:
        "Faculty updated successfully.",
    });
  } catch (error) {
    console.error(
      "Faculty update failed:",
      error
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The updated faculty code or another unique value already exists.",
          },
          {
            status: 409,
          }
        );
      }

      if (
        error.code === "P2025"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Faculty record was not found.",
          },
          {
            status: 404,
          }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update faculty.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const guard =
    await requireCoordinatorOrAdminApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    const { id } =
      await context.params;

    const facultyId =
      parsePositiveInteger(id);

    if (!facultyId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid faculty id.",
        },
        {
          status: 400,
        }
      );
    }

    const faculty =
      await prisma.teachers.findUnique({
        where: {
          id: facultyId,
        },
        select: {
          id: true,
          teacher_code: true,
          full_name: true,
          is_active: true,
        },
      });

    if (!faculty) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Faculty record was not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Faculty records can be referenced by
     * historical academic records.
     *
     * We must not destroy those records.
     * If references exist, Delete becomes a
     * safe archival/deactivation operation.
     */
    const [
      offeredCourseTeacherCount,
      facultySelectionCount,
      userCount,
      advisorAssignmentCount,
    ] =
      await Promise.all([
        prisma.offered_course_teachers.count({
          where: {
            teacher_id:
              facultyId,
          },
        }),

        prisma.faculty_course_selections.count({
          where: {
            teacher_id:
              facultyId,
          },
        }),

        prisma.users.count({
          where: {
            teacher_id:
              facultyId,
          },
        }),

        prisma.student_advisor_assignments.count({
          where: {
            teacher_id:
              facultyId,
          },
        }),
      ]);

    const totalReferences =
      offeredCourseTeacherCount +
      facultySelectionCount +
      userCount +
      advisorAssignmentCount;

    if (
      totalReferences > 0
    ) {
      const deactivated =
        await prisma.teachers.update({
          where: {
            id: facultyId,
          },
          data: {
            is_active: false,
          },
          include: {
            departments: true,
          },
        });

      return NextResponse.json({
        success: true,
        deleted: false,
        deactivated: true,
        faculty: deactivated,
        message:
          `Faculty ${faculty.teacher_code} - ${faculty.full_name} has historical/system references and cannot be physically deleted. The faculty has been safely deactivated instead.`,
        references: {
          offeredCourseAssignments:
            offeredCourseTeacherCount,

          facultyCourseSelections:
            facultySelectionCount,

          linkedUsers:
            userCount,

          advisorAssignments:
            advisorAssignmentCount,

          total:
            totalReferences,
        },
      });
    }

    await prisma.teachers.delete({
      where: {
        id: facultyId,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      deactivated: false,
      message:
        `Faculty ${faculty.teacher_code} - ${faculty.full_name} deleted successfully.`,
    });
  } catch (error) {
    console.error(
      "Faculty delete failed:",
      error
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code === "P2025"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Faculty record was not found.",
          },
          {
            status: 404,
          }
        );
      }

      if (
        error.code === "P2003"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This faculty is still referenced by academic records. Deactivate the faculty instead of deleting historical records.",
          },
          {
            status: 409,
          }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete faculty.",
      },
      {
        status: 500,
      }
    );
  }
}
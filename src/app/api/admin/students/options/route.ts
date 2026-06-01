import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const [programs, batches, advisors, catalogEntries] = await Promise.all([
      prisma.programs.findMany({
        orderBy: [{ short_name: "asc" }],
        select: {
          id: true,
          name: true,
          short_name: true,
          department_id: true,
          departments: {
            select: {
              id: true,
              name: true,
              short_name: true,
            },
          },
        },
      }),

      prisma.batches.findMany({
        orderBy: [{ batch_code: "asc" }],
        select: {
          id: true,
          batch_code: true,
          program_id: true,
          admission_term: true,
          is_active: true,
        },
      }),

      prisma.teachers.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ teacher_code: "asc" }],
        select: {
          id: true,
          teacher_code: true,
          full_name: true,
          designation: true,
        },
      }),

      prisma.academic_catalog_entries.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ display_label: "asc" }],
        select: {
          id: true,
          department_code: true,
          program_code: true,
          program_title: true,
          program_type: true,
          study_shift: true,
          curriculum_version: true,
          curriculum_key: true,
          display_label: true,
        },
      }),
    ]);

    const curriculumKeys = Array.from(
      new Set(
        catalogEntries
          .map((entry) => entry.curriculum_key)
          .filter((value): value is string => Boolean(value))
      )
    ).sort();

    return NextResponse.json({
      success: true,
      programs,
      batches,
      advisors,
      catalogEntries,
      curriculumKeys,
      statuses: [
        "ACTIVE",
        "INACTIVE",
        "DROPPED",
        "SEMESTER_DROP",
        "GRADUATED",
        "TRANSFERRED",
        "BLOCKED",
      ],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student options." },
      { status: 500 }
    );
  }
}
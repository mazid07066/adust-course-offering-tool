import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { resolveCanonicalProgram } from "@/lib/canonical-program";

const ROUTE_VERSION = "master-courses-delete-safe-v2";

type CatalogProgram = {
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: string;
  curriculumVersion: string;
  curriculumKey: string | null;
  studentIdSuffix: string | null;
  displayLabel: string;
};

async function getCatalogProgramByCode(programCode: string): Promise<CatalogProgram | null> {
  const row = await prisma.academic_catalog_entries.findFirst({
    where: {
      program_code: programCode,
      is_active: true,
    },
  });

  if (!row) return null;

  return {
    departmentCode: row.department_code,
    departmentName: row.department_name,
    programCode: row.program_code,
    programTitle: row.program_title,
    programType: row.program_type,
    studyShift: row.study_shift,
    curriculumVersion: row.curriculum_version,
    curriculumKey: row.curriculum_key,
    studentIdSuffix: row.student_id_suffix,
    displayLabel: row.display_label,
  };
}

export async function GET() {
  await requireCoordinatorOrAdminApi();

  return NextResponse.json({
    ok: true,
    routeVersion: ROUTE_VERSION,
    message: "master-courses delete route is active",
  });
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await request.json();
    const programCode = String(body.programCode || "").trim().toUpperCase();

    if (!programCode) {
      return NextResponse.json(
        { error: "programCode is required.", routeVersion: ROUTE_VERSION },
        { status: 400 }
      );
    }

    const catalogProgram = await getCatalogProgramByCode(programCode);

    if (!catalogProgram) {
      return NextResponse.json(
        {
          error: "Selected program/curriculum is not defined in academic setup.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    const effectiveCurriculumKey =
      (catalogProgram.curriculumKey || "").trim().toUpperCase() || catalogProgram.programCode;

    const program = await resolveCanonicalProgram({
      department_code: catalogProgram.departmentCode,
      department_name: catalogProgram.departmentName,
      program_code: catalogProgram.programCode,
      program_title: catalogProgram.programTitle,
      study_shift: catalogProgram.studyShift,
    });

    const existingRows = await prisma.master_courses.findMany({
      where: {
        OR: [
          { curriculum_key: effectiveCurriculumKey },
          { program_id: program.id },
        ],
      },
      select: {
        id: true,
      },
    });

    const existingIds = existingRows.map((row) => row.id);

    if (existingIds.length === 0) {
      return NextResponse.json({
        success: true,
        routeVersion: ROUTE_VERSION,
        message: "No master courses found for this program/curriculum.",
        deletedUnreferencedCount: 0,
        deactivatedReferencedCount: 0,
      });
    }

    const referencedRows = await prisma.offered_courses.findMany({
      where: {
        master_course_id: {
          in: existingIds,
        },
      },
      select: {
        master_course_id: true,
      },
      distinct: ["master_course_id"],
    });

    const referencedIds = new Set(referencedRows.map((row) => row.master_course_id));

    const referencedMasterCourseIds = existingIds.filter((id) => referencedIds.has(id));
    const unreferencedMasterCourseIds = existingIds.filter((id) => !referencedIds.has(id));

    let deletedUnreferencedCount = 0;
    let deactivatedReferencedCount = 0;

    if (unreferencedMasterCourseIds.length > 0) {
      const deleted = await prisma.master_courses.deleteMany({
        where: {
          id: {
            in: unreferencedMasterCourseIds,
          },
        },
      });
      deletedUnreferencedCount = deleted.count;
    }

    if (referencedMasterCourseIds.length > 0) {
      const updated = await prisma.master_courses.updateMany({
        where: {
          id: {
            in: referencedMasterCourseIds,
          },
        },
        data: {
          is_active: false,
        },
      });
      deactivatedReferencedCount = updated.count;
    }

    return NextResponse.json({
      success: true,
      routeVersion: ROUTE_VERSION,
      message: `Master course cleanup completed. Deleted unreferenced ${deletedUnreferencedCount}, deactivated referenced ${deactivatedReferencedCount}.`,
      deletedUnreferencedCount,
      deactivatedReferencedCount,
      programCode: catalogProgram.programCode,
      curriculumKey: effectiveCurriculumKey,
    });
  } catch (error) {
    console.error("MASTER COURSES DELETE ERROR", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Master course delete failed.",
        routeVersion: ROUTE_VERSION,
      },
      { status: 500 }
    );
  }
}
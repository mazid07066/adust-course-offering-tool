import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

type OfferingListItem = {
  id: number;
  status: string;
  createdAt: string | null;
  termName: string;
  year: number;
  termType: string;
  programCode: string;
  programName: string;
  departmentName: string;
  preparedByUserId: number;
  preparedByUsername: string;
  courseCount: number;
  totalBatchLinks: number;
  totalSlotCount: number;
};

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim();
}

async function findActivePrivilegedUser() {
  return prisma.users.findFirst({
    where: {
      is_active: true,
      role: {
        in: ["SUPER_ADMIN", "COORDINATOR"],
      },
    },
    orderBy: {
      id: "asc",
    },
  });
}

export async function GET(req: NextRequest) {
  await requireCoordinatorOrAdminApi();

  const { searchParams } = new URL(req.url);
  const programCode = normalizeText(searchParams.get("programCode"));
  const termName = normalizeText(searchParams.get("termName"));
  const status = normalizeText(searchParams.get("status"));

  const rows = await prisma.offerings.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(programCode
        ? {
            programs: {
              short_name: programCode,
            },
          }
        : {}),
      ...(termName
        ? {
            academic_terms: {
              name: termName,
            },
          }
        : {}),
    },
    orderBy: [
      { id: "desc" },
    ],
    include: {
      academic_terms: true,
      programs: {
        include: {
          departments: true,
        },
      },
      users: true,
      offered_courses: {
        include: {
          offered_course_batches: true,
          offered_course_slots: true,
        },
      },
    },
  });

  const offerings: OfferingListItem[] = rows.map((offering) => {
    const totalBatchLinks = offering.offered_courses.reduce((sum, course) => {
      return sum + course.offered_course_batches.length;
    }, 0);

    const totalSlotCount = offering.offered_courses.reduce((sum, course) => {
      return sum + course.offered_course_slots.length;
    }, 0);

    return {
      id: offering.id,
      status: offering.status,
      createdAt: offering.created_at ? offering.created_at.toISOString() : null,
      termName: offering.academic_terms.name,
      year: offering.academic_terms.year,
      termType: offering.academic_terms.term_type,
      programCode: offering.programs.short_name,
      programName: offering.programs.name,
      departmentName: offering.programs.departments.name,
      preparedByUserId: offering.prepared_by_user_id,
      preparedByUsername: offering.users.username,
      courseCount: offering.offered_courses.length,
      totalBatchLinks,
      totalSlotCount,
    };
  });

  return NextResponse.json({
    ok: true,
    offerings,
  });
}

export async function POST(req: NextRequest) {
  await requireCoordinatorOrAdminApi();

  const body = await req.json();

  const programCode = normalizeText(body.programCode);
  const termName = normalizeText(body.termName);
  const status = normalizeText(body.status) || "DRAFT";

  if (!programCode) {
    return NextResponse.json(
      { error: "programCode is required." },
      { status: 400 }
    );
  }

  if (!termName) {
    return NextResponse.json(
      { error: "termName is required." },
      { status: 400 }
    );
  }

  const program = await prisma.programs.findFirst({
    where: {
      short_name: programCode,
    },
  });

  if (!program) {
    return NextResponse.json(
      { error: `Program not found for code: ${programCode}` },
      { status: 404 }
    );
  }

  const term = await prisma.academic_terms.findFirst({
    where: {
      name: termName,
    },
  });

  if (!term) {
    return NextResponse.json(
      { error: `Academic term not found: ${termName}` },
      { status: 404 }
    );
  }

  const activeUser = await findActivePrivilegedUser();

  if (!activeUser) {
    return NextResponse.json(
      {
        error:
          "No active user found in users table. Please ensure at least one active SUPER_ADMIN or COORDINATOR user exists.",
      },
      { status: 400 }
    );
  }

  const existing = await prisma.offerings.findFirst({
    where: {
      program_id: program.id,
      academic_term_id: term.id,
      status,
    },
    include: {
      academic_terms: true,
      programs: true,
      users: true,
      offered_courses: true,
    },
  });

  if (existing) {
    return NextResponse.json({
      ok: true,
      reused: true,
      offering: {
        id: existing.id,
        status: existing.status,
        createdAt: existing.created_at ? existing.created_at.toISOString() : null,
        termName: existing.academic_terms.name,
        programCode: existing.programs.short_name,
        programName: existing.programs.name,
        preparedByUserId: existing.prepared_by_user_id,
        preparedByUsername: existing.users.username,
        courseCount: existing.offered_courses.length,
      },
    });
  }

  const created = await prisma.offerings.create({
    data: {
      academic_term_id: term.id,
      program_id: program.id,
      prepared_by_user_id: activeUser.id,
      status,
    },
    include: {
      academic_terms: true,
      programs: true,
      users: true,
      offered_courses: true,
    },
  });

  return NextResponse.json({
    ok: true,
    created: true,
    offering: {
      id: created.id,
      status: created.status,
      createdAt: created.created_at ? created.created_at.toISOString() : null,
      termName: created.academic_terms.name,
      programCode: created.programs.short_name,
      programName: created.programs.name,
      preparedByUserId: created.prepared_by_user_id,
      preparedByUsername: created.users.username,
      courseCount: created.offered_courses.length,
    },
  });
}
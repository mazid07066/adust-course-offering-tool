import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const q = String(searchParams.get("q") || "").trim();
    const status = String(searchParams.get("status") || "").trim().toUpperCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || 25)));
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (q) {
      where.OR = [
        { student_id: { contains: q, mode: "insensitive" } },
        { full_name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.current_status = status;
    }

    const [total, students] = await Promise.all([
      prisma.students.count({ where }),
      prisma.students.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ student_id: "asc" }],
        include: {
          enrollments: {
            take: 1,
            orderBy: [{ created_at: "desc" }, { id: "desc" }],
            include: {
              program: {
                include: {
                  departments: true,
                },
              },
              batches: true,
            },
          },
          advisor_assignments: {
            where: { is_active: true },
            take: 1,
            include: {
              teachers: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      students,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load students." },
      { status: 500 }
    );
  }
}
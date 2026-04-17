import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireSuperAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const faculties = await prisma.faculty.findMany({
      include: {
        department: true,
      },
      orderBy: [
        { department: { code: "asc" } },
        { initial: "asc" },
      ],
    });

    const departments = await prisma.department.findMany({
      orderBy: { code: "asc" },
    });

    return NextResponse.json({
      success: true,
      faculties,
      departments,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculties." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSuperAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();

    const {
      initial,
      name,
      designation,
      departmentCode,
      phone,
      email,
    } = body as {
      initial: string;
      name: string;
      designation?: string;
      departmentCode: string;
      phone?: string;
      email?: string;
    };

    if (!initial || !name || !departmentCode) {
      return NextResponse.json(
        { error: "initial, name, and departmentCode are required." },
        { status: 400 }
      );
    }

    const department = await prisma.department.findUnique({
      where: {
        code: departmentCode.trim().toUpperCase(),
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Department not found." },
        { status: 404 }
      );
    }

    const faculty = await prisma.faculty.upsert({
      where: {
        initial: initial.trim().toUpperCase(),
      },
      update: {
        name: name.trim(),
        designation: designation?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        departmentId: department.id,
        isActive: true,
      },
      create: {
        initial: initial.trim().toUpperCase(),
        name: name.trim(),
        designation: designation?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        departmentId: department.id,
        isActive: true,
      },
      include: {
        department: true,
      },
    });

    return NextResponse.json({
      success: true,
      faculty,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save faculty." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.academic_catalog_entries.findMany({
    where: { is_active: true },
    orderBy: [
      { department_code: "asc" },
      { program_title: "asc" },
      { study_shift: "asc" },
      { curriculum_version: "asc" },
    ],
  });

  const programs = items.map((item) => ({
    id: item.id,
    departmentCode: item.department_code,
    departmentName: item.department_name,
    programCode: item.program_code,
    programTitle: item.program_title,
    programType: item.program_type,
    studyShift: item.study_shift,
    curriculumVersion: item.curriculum_version,
    studentIdSuffix: item.student_id_suffix,
    displayLabel: item.display_label,
    active: item.is_active,
  }));

  return NextResponse.json({ programs });
}
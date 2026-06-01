import { NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  const headers = [
    "Student ID",
    "Full Name",
    "Program Code",
    "Batch Code",
    "Gender",
    "Date of Birth",
    "Phone",
    "Email",
    "Address",
    "Session",
    "Enrollment Status",
  ];

  const sampleRows = [
    [
      "232-0274-218",
      "Sample RAE Student",
      "BSC-RAE-REG-NEW",
      "232",
      "MALE",
      "2004-01-15",
      "01700000000",
      "student1@example.com",
      "Dhaka, Bangladesh",
      "2023-2024",
      "ACTIVE",
    ],
    [
      "261-0001-206",
      "Sample EEE Student",
      "BSC-EEE-REG-NEW",
      "261",
      "FEMALE",
      "2005-06-20",
      "01800000000",
      "student2@example.com",
      "Dhaka, Bangladesh",
      "2026-2027",
      "ACTIVE",
    ],
  ];

  const lines = [
    headers.map(csvEscape).join(","),
    ...sampleRows.map((row) => row.map(csvEscape).join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="student_bulk_import_template.csv"`,
    },
  });
}
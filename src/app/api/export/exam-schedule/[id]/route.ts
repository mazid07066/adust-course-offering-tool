import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import * as XLSX from "xlsx";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const scheduleId = Number(id);

    if (!Number.isFinite(scheduleId)) {
      return NextResponse.json(
        { error: "Invalid schedule id." },
        { status: 400 }
      );
    }

    const schedules = await prisma.$queryRaw<any[]>`
      SELECT
        es.*,
        at.name AS term_name
      FROM exam_schedules es
      JOIN academic_terms at ON at.id = es.academic_term_id
      WHERE es.id = ${scheduleId}
      LIMIT 1;
    `;

    const schedule = schedules[0];

    if (!schedule) {
      return NextResponse.json(
        { error: "Exam schedule not found." },
        { status: 404 }
      );
    }

    const items = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM exam_schedule_items
      WHERE exam_schedule_id = ${scheduleId}
      ORDER BY exam_date ASC, start_time ASC, room_code ASC, course_code ASC;
    `;

    const rows = items.map((item: any) => ({
      Date: String(item.exam_date).slice(0, 10),
      Time: `${item.start_time} - ${item.end_time}`,
      Room: item.room_code,
      Capacity: item.room_capacity,
      "Course Code": item.course_code,
      "Course Title": item.course_title,
      Section: item.section,
      Batches: item.batch_codes,
      "Student Count": item.student_count,
      "Seat Plan Note": item.seat_plan_note || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 20 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 42 },
      { wch: 10 },
      { wch: 18 },
      { wch: 14 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Exam Schedule");

    const summaryRows = [
      ["Title", schedule.title],
      ["Academic Term", schedule.term_name],
      ["Exam Type", schedule.exam_type],
      ["Status", schedule.status],
      [
        "Max Exams Per Batch Per Day",
        schedule.max_exams_per_batch_per_day,
      ],
      ["Total Scheduled Exams", items.length],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 32 }, { wch: 40 }];

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const safeTitle = String(schedule.title || "exam_schedule")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeTitle}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Exam schedule export error:", error);
    return NextResponse.json(
      { error: "Failed to export exam schedule." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

type ScheduleRow = {
  id: number;
  title: string;
  exam_type: string;
  academic_term_name: string;
  max_exams_per_batch_per_day: number;
};

type ItemRow = {
  id: number;
  offered_course_id: number | null;
  program_id: number | null;
  program_code: string | null;
  department_name: string | null;
  department_code: string | null;
  course_code: string;
  course_title: string;
  section: string;
  batch_codes: string;
  student_count: number;
  exam_date: Date | string;
  start_time: string;
  end_time: string;
  room_id: number | null;
  room_code: string | null;
  db_room_code: string | null;
  room_capacity: number | null;
  faculty_initial: string | null;
};

type RoomBlock = {
  roomKey: string;
  roomLabel: string;
  widthPairs: number;
};

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function splitStoredRoomCode(stored: string | null | undefined) {
  const raw = safeText(stored);
  const parts = raw.split("|").map((x) => x.trim());

  if (parts.length >= 2) {
    return {
      roomCode: parts[0],
      roomNumber: parts.slice(1).join(" | "),
    };
  }

  return {
    roomCode: raw,
    roomNumber: raw,
  };
}

function getRoomLabel(item: ItemRow) {
  const parsed = splitStoredRoomCode(item.db_room_code || item.room_code || "");
  return parsed.roomNumber || parsed.roomCode || item.room_code || "-";
}

function getRoomKey(item: ItemRow) {
  if (item.room_id) return `ROOM_ID_${item.room_id}`;
  return `ROOM_CODE_${getRoomLabel(item)}`;
}

function formatDateKey(value: Date | string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return safeText(value);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function formatDateDisplay(value: Date | string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return safeText(value);

  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const weekday = weekdays[d.getUTCDay()];

  return `${dd}/${mm}/${yyyy}\n(${weekday})`;
}

function minutesFromTime(value: string) {
  const text = safeText(value).toUpperCase();

  const amPmMatch = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (amPmMatch) {
    let hour = Number(amPmMatch[1]);
    const minute = Number(amPmMatch[2] || 0);
    const marker = amPmMatch[3];

    if (marker === "AM" && hour === 12) hour = 0;
    if (marker === "PM" && hour !== 12) hour += 12;

    return hour * 60 + minute;
  }

  const standardMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (standardMatch) {
    return Number(standardMatch[1]) * 60 + Number(standardMatch[2]);
  }

  const hourOnlyMatch = text.match(/^(\d{1,2})$/);
  if (hourOnlyMatch) return Number(hourOnlyMatch[1]) * 60;

  return 0;
}

function formatTime12(value: string) {
  const total = minutesFromTime(value);
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;

  const marker = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;

  return `${hour12}:${String(minute).padStart(2, "0")} ${marker}`;
}

function formatTimeRange(start: string, end: string) {
  return `${formatTime12(start)} -\n${formatTime12(end)}`;
}

function titleCaseExamType(value: string) {
  const text = safeText(value).toUpperCase();

  if (text === "MID" || text === "MIDTERM" || text === "MID_TERM") return "Mid";
  if (text === "FINAL") return "Final";

  return text
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sanitizeFileName(value: string) {
  return safeText(value)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

function encodeCell(row: number, col: number) {
  return XLSX.utils.encode_cell({
    r: row,
    c: col,
  });
}

function setCellStyle(ws: XLSX.WorkSheet, row: number, col: number, style: any) {
  const ref = encodeCell(row, col);
  if (!ws[ref]) ws[ref] = { t: "s", v: "" };
  ws[ref].s = style;
}

function applyStyleRange(
  ws: XLSX.WorkSheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  style: any
) {
  for (let r = startRow; r <= endRow; r += 1) {
    for (let c = startCol; c <= endCol; c += 1) {
      setCellStyle(ws, r, c, style);
    }
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { id } = await context.params;
    const scheduleId = Number(id);

    if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
      return NextResponse.json(
        { error: "Valid exam schedule id is required." },
        { status: 400 }
      );
    }

    const schedules = await prisma.$queryRaw<ScheduleRow[]>`
      SELECT
        es.id,
        es.title,
        es.exam_type,
        es.max_exams_per_batch_per_day,
        at.name AS academic_term_name
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

    const items = await prisma.$queryRaw<ItemRow[]>`
      SELECT
        esi.id,
        esi.offered_course_id,
        esi.program_id,
        p.short_name AS program_code,
        d.name AS department_name,
        d.short_name AS department_code,
        esi.course_code,
        esi.course_title,
        esi.section,
        esi.batch_codes,
        esi.student_count,
        esi.exam_date,
        esi.start_time,
        esi.end_time,
        esi.room_id,
        esi.room_code,
        r.room_code AS db_room_code,
        esi.room_capacity,
        COALESCE(
          STRING_AGG(DISTINCT t.teacher_code, ', ' ORDER BY t.teacher_code),
          ''
        ) AS faculty_initial
      FROM exam_schedule_items esi
      LEFT JOIN programs p ON p.id = esi.program_id
      LEFT JOIN departments d ON d.id = p.department_id
      LEFT JOIN rooms r ON r.id = esi.room_id
      LEFT JOIN offered_course_teachers oct
        ON oct.offered_course_id = esi.offered_course_id
      LEFT JOIN teachers t
        ON t.id = oct.teacher_id
      WHERE esi.exam_schedule_id = ${scheduleId}
      GROUP BY
        esi.id,
        esi.offered_course_id,
        esi.program_id,
        p.short_name,
        d.name,
        d.short_name,
        esi.course_code,
        esi.course_title,
        esi.section,
        esi.batch_codes,
        esi.student_count,
        esi.exam_date,
        esi.start_time,
        esi.end_time,
        esi.room_id,
        esi.room_code,
        r.room_code,
        esi.room_capacity
      ORDER BY
        esi.exam_date ASC,
        esi.start_time ASC,
        esi.end_time ASC,
        r.room_code ASC,
        esi.course_code ASC,
        esi.section ASC;
    `;

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No exam schedule items found for this schedule." },
        { status: 404 }
      );
    }

    const departmentLines = Array.from(
      new Map(
        items
          .filter((item) => item.department_name || item.department_code)
          .map((item) => {
            const name = item.department_name || "Department";
            const code = item.department_code || item.program_code || "";
            return [
              `${name}-${code}`,
              code ? `${name} (${code})` : name,
            ];
          })
      ).values()
    );

    const roomKeys = Array.from(new Set(items.map(getRoomKey)));

    const groupedByDateTime = new Map<string, ItemRow[]>();
    for (const item of items) {
      const key = [
        formatDateKey(item.exam_date),
        safeText(item.start_time),
        safeText(item.end_time),
      ].join("::");

      if (!groupedByDateTime.has(key)) groupedByDateTime.set(key, []);
      groupedByDateTime.get(key)!.push(item);
    }

    const roomBlocks: RoomBlock[] = roomKeys.map((roomKey) => {
      const roomItems = items.filter((item) => getRoomKey(item) === roomKey);
      const roomLabel = getRoomLabel(roomItems[0]);

      let maxConcurrent = 1;

      for (const groupItems of groupedByDateTime.values()) {
        const count = groupItems.filter((item) => getRoomKey(item) === roomKey).length;
        maxConcurrent = Math.max(maxConcurrent, count);
      }

      return {
        roomKey,
        roomLabel,
        widthPairs: maxConcurrent,
      };
    });

    const totalCols =
      2 + roomBlocks.reduce((sum, room) => sum + room.widthPairs * 2, 0);

    const aoa: any[][] = [];
    const merges: XLSX.Range[] = [];

    const title = "Atish Dipankar University of Science & Technology (ADUST)";
    const scheduleTitle = `Schedule of ${titleCaseExamType(schedule.exam_type)} Examinations, ${schedule.academic_term_name}`;

    aoa.push([title, ...Array(Math.max(0, totalCols - 1)).fill(null)]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

    if (departmentLines.length > 0) {
      for (const line of departmentLines) {
        aoa.push([line, ...Array(Math.max(0, totalCols - 1)).fill(null)]);
        merges.push({
          s: { r: aoa.length - 1, c: 0 },
          e: { r: aoa.length - 1, c: totalCols - 1 },
        });
      }
    } else {
      aoa.push(["Department", ...Array(Math.max(0, totalCols - 1)).fill(null)]);
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });
    }

    aoa.push(Array(totalCols).fill(null));

    aoa.push([scheduleTitle, ...Array(Math.max(0, totalCols - 1)).fill(null)]);
    merges.push({
      s: { r: aoa.length - 1, c: 0 },
      e: { r: aoa.length - 1, c: totalCols - 1 },
    });

    aoa.push(Array(totalCols).fill(null));

    const headerRowIndex = aoa.length;
    const headerRow = Array(totalCols).fill(null);
    headerRow[0] = "Date";
    headerRow[1] = "Time";
    headerRow[2] = "Room";
    aoa.push(headerRow);

    merges.push({ s: { r: headerRowIndex, c: 2 }, e: { r: headerRowIndex, c: totalCols - 1 } });

    const sortedGroups = Array.from(groupedByDateTime.entries()).sort((a, b) => {
      const [dateA, startA, endA] = a[0].split("::");
      const [dateB, startB, endB] = b[0].split("::");
      return `${dateA}-${startA}-${endA}`.localeCompare(`${dateB}-${startB}-${endB}`);
    });

    const groupsByDate = new Map<string, Array<[string, ItemRow[]]>>();
    for (const entry of sortedGroups) {
      const dateKey = entry[0].split("::")[0];
      if (!groupsByDate.has(dateKey)) groupsByDate.set(dateKey, []);
      groupsByDate.get(dateKey)!.push(entry);
    }

    for (const [dateKey, dateGroups] of groupsByDate.entries()) {
      const dateStartRow = aoa.length;

      for (let groupIndex = 0; groupIndex < dateGroups.length; groupIndex += 1) {
        const [groupKey, groupItems] = dateGroups[groupIndex];
        const [, startTime, endTime] = groupKey.split("::");

        const roomHeaderRow = Array(totalCols).fill(null);
        const courseRow = Array(totalCols).fill(null);
        const studentRow = Array(totalCols).fill(null);

        if (groupIndex === 0) {
          roomHeaderRow[0] = formatDateDisplay(groupItems[0].exam_date);
        }

        roomHeaderRow[1] = formatTimeRange(startTime, endTime);
        studentRow[1] = "No. of Students";

        let col = 2;

        for (const room of roomBlocks) {
          const roomWidth = room.widthPairs * 2;

          roomHeaderRow[col] = room.roomLabel;

          if (roomWidth > 1) {
            merges.push({
              s: { r: aoa.length, c: col },
              e: { r: aoa.length, c: col + roomWidth - 1 },
            });
          }

          const matchingItems = groupItems.filter(
            (item) => getRoomKey(item) === room.roomKey
          );

          for (let pairIndex = 0; pairIndex < room.widthPairs; pairIndex += 1) {
            const item = matchingItems[pairIndex];
            const courseCol = col + pairIndex * 2;
            const facultyCol = courseCol + 1;

            if (item) {
              const sectionText = safeText(item.section).replace(/^SEC-?/i, "");
              courseRow[courseCol] = `${item.course_code}\nSec-${sectionText}`;
              courseRow[facultyCol] = safeText(item.faculty_initial) || "";
              studentRow[courseCol] = Number(item.student_count || 0);
              studentRow[facultyCol] = "";
            }
          }

          col += roomWidth;
        }

        const roomHeaderRowIndex = aoa.length;
        aoa.push(roomHeaderRow);
        aoa.push(courseRow);
        aoa.push(studentRow);

        merges.push({
          s: { r: roomHeaderRowIndex, c: 1 },
          e: { r: roomHeaderRowIndex + 1, c: 1 },
        });
      }

      const dateEndRow = aoa.length - 1;

      if (dateEndRow > dateStartRow) {
        merges.push({
          s: { r: dateStartRow, c: 0 },
          e: { r: dateEndRow, c: 0 },
        });
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws["!merges"] = merges;
    ws["!cols"] = [
      { wch: 18 },
      { wch: 18 },
      ...roomBlocks.flatMap((room) =>
        Array(room.widthPairs)
          .fill(null)
          .flatMap(() => [{ wch: 18 }, { wch: 10 }])
      ),
    ];

    ws["!rows"] = aoa.map((_, index) => {
      if (index <= 5) return { hpt: 24 };
      return { hpt: 52 };
    });

    const thinBorder = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    };

    const titleStyle = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    };

    const subtitleStyle = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    };

    const headerStyle = {
      font: { bold: true, sz: 12 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder,
    };

    const bodyStyle = {
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder,
    };

    const boldBodyStyle = {
      font: { bold: true },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder,
    };

    for (let r = 0; r < aoa.length; r += 1) {
      for (let c = 0; c < totalCols; c += 1) {
        if (!ws[encodeCell(r, c)]) {
          ws[encodeCell(r, c)] = { t: "s", v: "" };
        }
      }
    }

    applyStyleRange(ws, 0, 0, 0, totalCols - 1, titleStyle);

    for (let r = 1; r < headerRowIndex - 1; r += 1) {
      applyStyleRange(ws, r, 0, r, totalCols - 1, subtitleStyle);
    }

    applyStyleRange(ws, headerRowIndex, 0, headerRowIndex, totalCols - 1, headerStyle);

    for (let r = headerRowIndex + 1; r < aoa.length; r += 1) {
      applyStyleRange(ws, r, 0, r, totalCols - 1, bodyStyle);

      const isRoomHeaderRow = (r - (headerRowIndex + 1)) % 3 === 0;
      const isStudentRow = (r - (headerRowIndex + 1)) % 3 === 2;

      if (isRoomHeaderRow || isStudentRow) {
        applyStyleRange(ws, r, 0, r, totalCols - 1, boldBodyStyle);
      }
    }

    ws["!freeze"] = { xSplit: 0, ySplit: headerRowIndex + 1 };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Exam Schedule");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      cellStyles: true,
    });

    const fileName = `${sanitizeFileName(schedule.title || "exam_schedule")}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Exam schedule XLSX export error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export exam schedule.",
      },
      { status: 500 }
    );
  }
}
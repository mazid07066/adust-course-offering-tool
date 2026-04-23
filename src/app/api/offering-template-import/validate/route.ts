import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

type PreviewRow = {
  status?: string;
  batchCode?: string;
  courseCode?: string;
  courseTitle?: string;
  coofferedCourseCode?: string;
  facultyInitial?: string;
  section?: string;
  credit?: number;
  day?: string;
  time?: string;
  room?: string;
  issues?: string[];
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function extractTimeParts(input: string) {
  const text = String(input || "").replace(/\s+/g, " ").trim().toUpperCase();

  const regex =
    /(\d{1,2}:\d{2}\s*(?:AM|PM)?)[\s-]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i;

  const match = text.match(regex);
  if (!match) return null;

  return {
    start: match[1].replace(/\s+/g, ""),
    end: match[2].replace(/\s+/g, ""),
  };
}

function toMinutes(value: string) {
  const raw = normalize(value).replace(/\s+/g, "");
  const matched = raw.match(/^(\d{1,2}):(\d{2})(AM|PM)?$/);

  if (!matched) return null;

  let hour = Number(matched[1]);
  const minute = Number(matched[2]);
  const meridiem = matched[3] || null;

  if (meridiem === "AM") {
    if (hour === 12) hour = 0;
  } else if (meridiem === "PM") {
    if (hour !== 12) hour += 12;
  }

  return hour * 60 + minute;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();
    const termName = normalize(body.termName);
    const rows = Array.isArray(body.rows) ? (body.rows as PreviewRow[]) : [];

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const term = await prisma.academic_terms.findFirst({
      where: { name: termName },
      select: { id: true, name: true },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const existing = await prisma.offered_courses.findMany({
      where: {
        offerings: {
          academic_term_id: term.id,
        },
      },
      include: {
        offered_course_batches: {
          include: {
            batches: true,
          },
        },
        offered_course_slots: {
          include: {
            rooms: true,
          },
        },
        offered_course_teachers: {
          include: {
            teachers: true,
          },
        },
        primary_offered_course: {
          include: {
            offered_course_slots: {
              include: {
                rooms: true,
              },
            },
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
          },
        },
      },
    });

    const existingEvents = existing.flatMap((course) => {
      const slots =
        course.primary_offered_course?.offered_course_slots.length
          ? course.primary_offered_course.offered_course_slots
          : course.offered_course_slots;

      const teachers =
        course.primary_offered_course?.offered_course_teachers.length
          ? course.primary_offered_course.offered_course_teachers
          : course.offered_course_teachers;

      const batchCodes = course.offered_course_batches.map((x) => normalize(x.batches.batch_code));

      return slots
        .map((slot) => {
          const start = toMinutes(slot.start_time);
          const end = toMinutes(slot.end_time);
          if (start == null || end == null) return null;

          return {
            day: normalize(slot.day_of_week),
            room: normalize(slot.rooms?.room_code || "-"),
            teacherInitials: teachers.map((x) => normalize(x.teachers.teacher_code)),
            batchCodes,
            start,
            end,
          };
        })
        .filter(Boolean) as Array<{
        day: string;
        room: string;
        teacherInitials: string[];
        batchCodes: string[];
        start: number;
        end: number;
      }>;
    });

    const uploadEvents: Array<{
      index: number;
      day: string;
      room: string;
      facultyInitial: string;
      batchCode: string;
      start: number;
      end: number;
    }> = [];

    const validatedRows = rows.map((row, index) => {
      const issues = [...(row.issues || [])];
      const conflictTypes: string[] = [];

      if (normalize(row.status) === "BLOCKED") {
        return {
          ...row,
          validationStatus: "BLOCKED",
          conflictTypes,
          issues,
        };
      }

      const timeParts = extractTimeParts(String(row.time || ""));
      const start = timeParts ? toMinutes(timeParts.start) : null;
      const end = timeParts ? toMinutes(timeParts.end) : null;
      const day = normalize(row.day);
      const room = normalize(row.room);
      const facultyInitial = normalize(row.facultyInitial);
      const batchCode = normalize(row.batchCode);

      if (day && start != null && end != null) {
        uploadEvents.push({
          index,
          day,
          room,
          facultyInitial,
          batchCode,
          start,
          end,
        });
      }

      return {
        ...row,
        validationStatus: "OK",
        conflictTypes,
        issues,
      };
    });

    for (const event of uploadEvents) {
      const row = validatedRows[event.index];

      for (const other of uploadEvents) {
        if (other.index === event.index) continue;
        if (other.day !== event.day) continue;
        if (!overlaps(event.start, event.end, other.start, other.end)) continue;

        if (event.room && other.room && event.room === other.room) {
          row.conflictTypes.push("UPLOAD_ROOM_CONFLICT");
        }

        if (
          event.facultyInitial &&
          other.facultyInitial &&
          event.facultyInitial === other.facultyInitial
        ) {
          row.conflictTypes.push("UPLOAD_FACULTY_CONFLICT");
        }

        if (event.batchCode && other.batchCode && event.batchCode === other.batchCode) {
          row.conflictTypes.push("UPLOAD_BATCH_CONFLICT");
        }
      }

      for (const existingEvent of existingEvents) {
        if (existingEvent.day !== event.day) continue;
        if (!overlaps(event.start, event.end, existingEvent.start, existingEvent.end)) continue;

        if (event.room && existingEvent.room && event.room === existingEvent.room) {
          row.conflictTypes.push("EXISTING_ROOM_CONFLICT");
        }

        if (
          event.facultyInitial &&
          existingEvent.teacherInitials.includes(event.facultyInitial)
        ) {
          row.conflictTypes.push("EXISTING_FACULTY_CONFLICT");
        }

        if (
          event.batchCode &&
          existingEvent.batchCodes.includes(event.batchCode)
        ) {
          row.conflictTypes.push("EXISTING_BATCH_CONFLICT");
        }
      }

      row.conflictTypes = Array.from(new Set(row.conflictTypes));

      if (row.conflictTypes.length > 0) {
        row.validationStatus = "CONFLICT";
        row.issues = [
          ...row.issues,
          ...row.conflictTypes.map((x) => x.replaceAll("_", " ")),
        ];
      }
    }

    const summary = {
      totalRows: validatedRows.length,
      okRows: validatedRows.filter((x) => x.validationStatus === "OK").length,
      conflictRows: validatedRows.filter((x) => x.validationStatus === "CONFLICT").length,
      blockedRows: validatedRows.filter((x) => x.validationStatus === "BLOCKED").length,
    };

    return NextResponse.json({
      success: true,
      termName: term.name,
      summary,
      rows: validatedRows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to validate offering template rows." },
      { status: 500 }
    );
  }
}
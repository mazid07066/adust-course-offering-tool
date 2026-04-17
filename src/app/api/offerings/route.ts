import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

type SlotInput = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
};

const ALLOWED_DAYS = ["SUN", "MON", "THU", "FRI", "SAT"];

function normalizeSeason(season: string): string {
  const s = season.trim().toLowerCase();
  if (s === "spring") return "SPRING";
  if (s === "summer") return "SUMMER";
  if (s === "fall") return "FALL";
  throw new Error("Season must be spring, summer, or fall.");
}

function buildSemesterTitle(season: string, year: string) {
  return `${normalizeSeason(season)} ${year.trim()}`;
}

function toMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return hh * 60 + mm;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a1 = toMinutes(aStart);
  const a2 = toMinutes(aEnd);
  const b1 = toMinutes(bStart);
  const b2 = toMinutes(bEnd);
  return a1 < b2 && b1 < a2;
}

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();

    const {
      semesterSeason,
      semesterYear,
      courseId,
      coOfferedCourseId,
      section,
      facultyId,
      roomId,
      batchIds,
      slots,
      remarks,
    } = body as {
      semesterSeason: string;
      semesterYear: string;
      courseId: string;
      coOfferedCourseId?: string | null;
      section: string;
      facultyId?: string | null;
      roomId?: string | null;
      batchIds: string[];
      slots: SlotInput[];
      remarks?: string;
    };

    if (!semesterSeason || !semesterYear || !courseId || !section || !batchIds?.length || !slots?.length) {
      return NextResponse.json(
        { error: "semester, course, section, batchIds, and slots are required." },
        { status: 400 }
      );
    }

    if (slots.length < 1) {
      return NextResponse.json(
        { error: "At least one class slot is required." },
        { status: 400 }
      );
    }

    for (const slot of slots) {
      if (!slot.dayOfWeek || !slot.startTime || !slot.endTime) {
        return NextResponse.json(
          { error: "Each slot must include day, start time, and end time." },
          { status: 400 }
        );
      }

      if (!ALLOWED_DAYS.includes(slot.dayOfWeek)) {
        return NextResponse.json(
          { error: "Classes are allowed only on SUN, MON, and THU. TUE and WED are off-days." },
          { status: 400 }
        );
      }

      const duration = toMinutes(slot.endTime) - toMinutes(slot.startTime);

      if (duration < 60 || duration > 120) {
        return NextResponse.json(
          { error: "Each class must be between 1 hour and 2 hours." },
          { status: 400 }
        );
      }

      if (toMinutes(slot.startTime) >= toMinutes(slot.endTime)) {
        return NextResponse.json(
          { error: `Invalid time range for ${slot.dayOfWeek}.` },
          { status: 400 }
        );
      }
    }

    const semesterTitle = buildSemesterTitle(semesterSeason, semesterYear);
    const semesterCode = semesterTitle.replace(/\s+/g, "-");

    const semester = await prisma.semester.upsert({
      where: { code: semesterCode },
      update: { title: semesterTitle },
      create: {
        code: semesterCode,
        title: semesterTitle,
        isActive: true,
      },
    });

    const existingOfferings = await prisma.offering.findMany({
      where: {
        semesterId: semester.id,
      },
      include: {
        slots: true,
        offeringBatches: true,
      },
    });

    for (const existing of existingOfferings) {
      for (const existingSlot of existing.slots) {
        for (const newSlot of slots) {
          if (
            existingSlot.dayOfWeek === newSlot.dayOfWeek &&
            overlaps(existingSlot.startTime, existingSlot.endTime, newSlot.startTime, newSlot.endTime)
          ) {
            const sharedBatch = existing.offeringBatches.some((ob) => batchIds.includes(ob.batchId));
            if (sharedBatch) {
              return NextResponse.json(
                {
                  error: `Batch conflict detected on ${newSlot.dayOfWeek} ${newSlot.startTime}-${newSlot.endTime}.`,
                },
                { status: 400 }
              );
            }

            if (facultyId && existing.facultyId && existing.facultyId === facultyId) {
              return NextResponse.json(
                {
                  error: `Faculty conflict detected on ${newSlot.dayOfWeek} ${newSlot.startTime}-${newSlot.endTime}.`,
                },
                { status: 400 }
              );
            }

            if (roomId && existing.roomId && existing.roomId === roomId) {
              return NextResponse.json(
                {
                  error: `Room conflict detected on ${newSlot.dayOfWeek} ${newSlot.startTime}-${newSlot.endTime}.`,
                },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    const existingSameSection = await prisma.offering.findFirst({
      where: {
        semesterId: semester.id,
        courseId,
        section,
      },
    });

    if (existingSameSection) {
      return NextResponse.json(
        { error: "This course section already exists in the selected semester." },
        { status: 400 }
      );
    }

    let coOfferedCourseCode: string | null = null;
    let coOfferedCourseTitle: string | null = null;
    let coOfferedDepartmentCode: string | null = null;

    if (coOfferedCourseId) {
      const coOfferedCourse = await prisma.course.findUnique({
        where: { id: coOfferedCourseId },
        include: {
          program: true,
        },
      });

      if (coOfferedCourse) {
        coOfferedCourseCode = coOfferedCourse.code;
        coOfferedCourseTitle = coOfferedCourse.title;
        coOfferedDepartmentCode = coOfferedCourse.program.code;
      }
    }

    const offering = await prisma.offering.create({
      data: {
        semesterId: semester.id,
        courseId,
        section,
        facultyId: facultyId || null,
        roomId: roomId || null,
        remarks: remarks || null,
        isCoOffered: Boolean(coOfferedCourseId) || batchIds.length > 1,
        coOfferedCourseId: coOfferedCourseId || null,
        coOfferedCourseCode,
        coOfferedCourseTitle,
        coOfferedDepartmentCode,
        offeringBatches: {
          create: batchIds.map((batchId) => ({
            batchId,
          })),
        },
        slots: {
          create: slots.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        },
      },
      include: {
        course: {
          include: {
            program: true,
          },
        },
        faculty: true,
        room: true,
        slots: true,
        offeringBatches: {
          include: {
            batch: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      offering,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save offering." },
      { status: 500 }
    );
  }
}
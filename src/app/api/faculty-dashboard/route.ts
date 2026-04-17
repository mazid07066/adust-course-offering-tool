import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

const DAYS = ["SAT, "SUN", "MON", "THU", "FRI"];

function isLabCourse(title: string, courseType: string | null | undefined) {
  const t = (title || "").toUpperCase();
  const ct = (courseType || "").toUpperCase();
  return t.includes("LAB") || ct.includes("LAB");
}

export async function GET(request: NextRequest) {
  await requireSuperAdmin();
  try {
    const { searchParams } = new URL(request.url);

    const season = String(searchParams.get("season") || "").trim();
    const year = String(searchParams.get("year") || "").trim();
    const facultyId = String(searchParams.get("facultyId") || "").trim();

    if (!season || !year) {
      return NextResponse.json(
        { error: "season and year are required." },
        { status: 400 }
      );
    }

    const semesterTitle = buildSemesterTitle(season, year);
    const semesterCode = semesterTitle.replace(/\s+/g, "-");

    const semester = await prisma.semester.findUnique({
      where: { code: semesterCode },
    });

    if (!semester) {
      return NextResponse.json({ error: "Semester not found." }, { status: 404 });
    }

    const faculties = await prisma.faculty.findMany({
      where: { isActive: true },
      include: {
        department: true,
      },
      orderBy: [{ initial: "asc" }],
    });

    const offerings = await prisma.offering.findMany({
      where: {
        semesterId: semester.id,
        ...(facultyId ? { facultyId } : {}),
      },
      include: {
        course: {
          include: {
            program: true,
          },
        },
        faculty: {
          include: {
            department: true,
          },
        },
        room: true,
        slots: true,
        offeringBatches: {
          include: {
            batch: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const facultyLoadRows = faculties.map((faculty) => {
      const assigned = offerings.filter((offering) => offering.facultyId === faculty.id);

      let theory = 0;
      let lab = 0;

      for (const offering of assigned) {
        const credit = Number(offering.course.creditHours || 0);
        if (isLabCourse(offering.course.title, offering.course.courseType)) {
          lab += credit;
        } else {
          theory += credit;
        }
      }

      return {
        facultyId: faculty.id,
        initial: faculty.initial,
        name: faculty.name,
        designation: faculty.designation,
        departmentCode: faculty.department.code,
        phone: faculty.phone,
        email: faculty.email,
        theoryLoad: theory,
        labLoad: lab,
        totalLoad: theory + lab,
      };
    });

    const facultyRoutines = faculties.map((faculty) => {
      const assigned = offerings.filter((offering) => offering.facultyId === faculty.id);

      const dayWise = DAYS.reduce<Record<string, any[]>>((acc, day) => {
        acc[day] = [];
        return acc;
      }, {});

      for (const offering of assigned) {
        for (const slot of offering.slots) {
          dayWise[slot.dayOfWeek] ??= [];
          dayWise[slot.dayOfWeek].push({
            courseCode: offering.course.code,
            coOfferedCourseCode: offering.coOfferedCourseCode,
            displayCourseCodes: offering.coOfferedCourseCode
              ? `${offering.course.code} / ${offering.coOfferedCourseCode}`
              : offering.course.code,
            courseTitle: offering.course.title,
            section: offering.section,
            batches: offering.offeringBatches.map((ob) => ob.batch.code).join(", "),
            room: offering.room?.roomCode ?? "-",
            startTime: slot.startTime,
            endTime: slot.endTime,
          });
        }
      }

      for (const day of Object.keys(dayWise)) {
        dayWise[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
      }

      return {
        facultyId: faculty.id,
        initial: faculty.initial,
        name: faculty.name,
        designation: faculty.designation,
        departmentCode: faculty.department.code,
        phone: faculty.phone,
        email: faculty.email,
        routine: dayWise,
      };
    });

    return NextResponse.json({
      success: true,
      semester: semester.title,
      faculties: faculties.map((f) => ({
        id: f.id,
        initial: f.initial,
        name: f.name,
        designation: f.designation,
        departmentCode: f.department.code,
      })),
      facultyLoadRows,
      facultyRoutines,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load faculty dashboard." },
      { status: 500 }
    );
  }
}
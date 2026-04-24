import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const DAYS = ["SATURDAY", "SUNDAY", "MONDAY", "THURSDAY", "FRIDAY"];

function isLabCourse(title: string, courseType: string | null | undefined) {
  const t = String(title || "").toUpperCase();
  const ct = String(courseType || "").toUpperCase();
  return t.includes("LAB") || ct.includes("LAB");
}

export async function GET(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();
    const teacherIdRaw = String(searchParams.get("teacherId") || "").trim();
    const teacherId = teacherIdRaw ? Number(teacherIdRaw) : null;

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
      return NextResponse.json({ error: "Academic term not found." }, { status: 404 });
    }

    const teachers = await prisma.teachers.findMany({
      where: {
        is_active: true,
        ...(teacherId ? { id: teacherId } : {}),
      },
      include: {
        departments: true,
      },
      orderBy: [{ teacher_code: "asc" }],
    });

    const assignments = await prisma.offered_course_teachers.findMany({
      where: {
        ...(teacherId ? { teacher_id: teacherId } : {}),
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
          },
        },
      },
      include: {
        teachers: {
          include: {
            departments: true,
          },
        },
        offered_courses: {
          include: {
            offerings: true,
            master_courses: {
              include: {
                program: true,
              },
            },
            offered_course_batches: {
              include: {
                batches: true,
              },
            },
            offered_course_slots: {
              include: {
                rooms: true,
              },
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
            },
            secondary_offered_courses: {
              include: {
                master_courses: {
                  include: {
                    program: true,
                  },
                },
                offered_course_batches: {
                  include: {
                    batches: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ teacher_id: "asc" }, { offered_course_id: "asc" }],
    });

    const facultyLoadRows = teachers.map((teacher) => {
      const assigned = assignments.filter((row) => row.teacher_id === teacher.id);

      let theoryLoad = 0;
      let labLoad = 0;

      for (const row of assigned) {
        const course = row.offered_courses.master_courses;
        const credit = Number(row.assigned_credit || course.credit || 0);

        if (isLabCourse(course.course_title, course.course_type)) {
          labLoad += credit;
        } else {
          theoryLoad += credit;
        }
      }

      return {
        facultyId: teacher.id,
        initial: teacher.teacher_code,
        name: teacher.full_name,
        designation: teacher.designation || "-",
        departmentCode: teacher.departments?.short_name || "-",
        phone: teacher.phone || "-",
        email: teacher.email || "-",
        theoryLoad,
        labLoad,
        totalLoad: Number((theoryLoad + labLoad).toFixed(2)),
      };
    });

    const facultyRoutines = teachers.map((teacher) => {
      const assigned = assignments.filter((row) => row.teacher_id === teacher.id);

      const dayWise = DAYS.reduce<Record<string, any[]>>((acc, day) => {
        acc[day] = [];
        return acc;
      }, {});

      for (const assignment of assigned) {
        const offeredCourse = assignment.offered_courses;
        const course = offeredCourse.master_courses;

        for (const slot of offeredCourse.offered_course_slots) {
          const day = slot.day_of_week;
          dayWise[day] ??= [];

          dayWise[day].push({
            courseCode: course.course_code,
            displayCourseCodes:
              offeredCourse.secondary_offered_courses.length > 0
                ? [
                    course.course_code,
                    ...offeredCourse.secondary_offered_courses.map(
                      (secondary) => secondary.master_courses.course_code
                    ),
                  ].join(" / ")
                : course.course_code,
            courseTitle: course.course_title,
            section: offeredCourse.section,
            programCode: course.program.short_name,
            batches: offeredCourse.offered_course_batches
              .map((row) => row.batches.batch_code)
              .join(", "),
            room: slot.rooms?.room_code || "-",
            startTime: slot.start_time,
            endTime: slot.end_time,
          });
        }
      }

      for (const day of Object.keys(dayWise)) {
        dayWise[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
      }

      return {
        facultyId: teacher.id,
        initial: teacher.teacher_code,
        name: teacher.full_name,
        designation: teacher.designation || "-",
        departmentCode: teacher.departments?.short_name || "-",
        phone: teacher.phone || "-",
        email: teacher.email || "-",
        routine: dayWise,
      };
    });

    return NextResponse.json({
      success: true,
      semester: term.name,
      faculties: teachers.map((teacher) => ({
        id: teacher.id,
        initial: teacher.teacher_code,
        name: teacher.full_name,
        designation: teacher.designation || "-",
        departmentCode: teacher.departments?.short_name || "-",
      })),
      facultyLoadRows,
      facultyRoutines,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load faculty dashboard.",
      },
      { status: 500 }
    );
  }
}
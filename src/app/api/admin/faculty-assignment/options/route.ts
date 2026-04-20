import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const ALLOWED_OFFERING_STATUSES = [
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

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

    const faculties = await prisma.teachers.findMany({
      where: {
        is_active: true,
      },
      orderBy: [{ teacher_code: "asc" }],
      select: {
        id: true,
        teacher_code: true,
        full_name: true,
        designation: true,
      },
    });

    const courses = await prisma.offered_courses.findMany({
      where: {
        primary_offered_course_id: null,
        offerings: {
          academic_term_id: term.id,
          status: {
            in: ALLOWED_OFFERING_STATUSES,
          },
        },
      },
      orderBy: [
        { offerings: { program_id: "asc" } },
        { section: "asc" },
        { id: "asc" },
      ],
      include: {
        offerings: {
          include: {
            programs: true,
          },
        },
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
          orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
          include: {
            rooms: true,
          },
        },
        offered_course_teachers: {
          include: {
            teachers: true,
          },
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
    });

    const selections = await prisma.faculty_course_selections.findMany({
      where: {
        academic_term_id: term.id,
        offered_course_id: {
          in: courses.map((course) => course.id),
        },
      },
      orderBy: [
        { status: "asc" },
        { priority_order: "asc" },
        { id: "asc" },
      ],
      include: {
        teachers: true,
      },
    });

    const selectionMap = new Map<number, typeof selections>();
    for (const selection of selections) {
      const current = selectionMap.get(selection.offered_course_id) || [];
      current.push(selection);
      selectionMap.set(selection.offered_course_id, current);
    }

    const teacherLoadRows = await prisma.offered_course_teachers.findMany({
      where: {
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
          },
        },
      },
      include: {
        teachers: true,
        offered_courses: {
          include: {
            master_courses: true,
          },
        },
      },
    });

    const teacherLoadMap = new Map<
      number,
      {
        teacherId: number;
        teacherCode: string;
        teacherName: string;
        designation: string | null;
        totalAssignedCredits: number;
        totalAssignedSections: number;
      }
    >();

    for (const row of teacherLoadRows) {
      const teacherId = row.teacher_id;

      if (!teacherLoadMap.has(teacherId)) {
        teacherLoadMap.set(teacherId, {
          teacherId,
          teacherCode: row.teachers.teacher_code,
          teacherName: row.teachers.full_name,
          designation: row.teachers.designation,
          totalAssignedCredits: 0,
          totalAssignedSections: 0,
        });
      }

      const item = teacherLoadMap.get(teacherId)!;
      item.totalAssignedCredits += Number(row.assigned_credit || 0);
      item.totalAssignedSections += 1;
    }

    const payload = courses.map((course) => {
      const selectedRows = selectionMap.get(course.id) || [];

      const sortedSelections = [...selectedRows].sort((a, b) => {
        if (a.status === b.status) {
          return (a.priority_order || 9999) - (b.priority_order || 9999);
        }
        if (a.status === "FINAL" && b.status !== "FINAL") return -1;
        if (a.status !== "FINAL" && b.status === "FINAL") return 1;
        return 0;
      });

      return {
        offeredCourseId: course.id,
        offeringId: course.offering_id,
        offeringStatus: course.offerings.status,
        programCode: course.master_courses.program.short_name,
        programName: course.master_courses.program.name,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        section: course.section,
        credit: Number(course.master_courses.credit || 0),
        batchCodes: course.offered_course_batches.map((x) => x.batches.batch_code),
        schedule: course.offered_course_slots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          roomCode: slot.rooms?.room_code || "-",
        })),
        linkedSecondaryCourses: course.secondary_offered_courses.map((secondary) => ({
          id: secondary.id,
          courseCode: secondary.master_courses.course_code,
          courseTitle: secondary.master_courses.course_title,
          section: secondary.section,
          programCode: secondary.master_courses.program.short_name,
          batchCodes: secondary.offered_course_batches.map((x) => x.batches.batch_code),
        })),
        assignedTeachers: course.offered_course_teachers.map((row) => ({
          teacherId: row.teacher_id,
          teacherCode: row.teachers.teacher_code,
          teacherName: row.teachers.full_name,
          designation: row.teachers.designation,
          assignedCredit: Number(row.assigned_credit || 0),
          loadType: row.load_type,
        })),
        selectedByFaculties: sortedSelections.map((row) => ({
          teacherId: row.teacher_id,
          teacherCode: row.teachers.teacher_code,
          teacherName: row.teachers.full_name,
          designation: row.teachers.designation,
          status: row.status,
          priorityOrder: row.priority_order,
          confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
          selectedAt: row.selected_at ? row.selected_at.toISOString() : null,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      termName: term.name,
      faculties: faculties.map((faculty) => ({
        id: faculty.id,
        teacherCode: faculty.teacher_code,
        fullName: faculty.full_name,
        designation: faculty.designation,
      })),
      teacherLoadSummary: Array.from(teacherLoadMap.values()).sort((a, b) =>
        a.teacherCode.localeCompare(b.teacherCode)
      ),
      courses: payload,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculty assignment board." },
      { status: 500 }
    );
  }
}
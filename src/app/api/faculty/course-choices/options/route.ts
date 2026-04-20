import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { cookies } from "next/headers";
import { validateFacultySession, getRemainingMinutes } from "@/lib/faculty-session";
import { getFacultyChoiceWindowStatus } from "@/lib/system-settings";

const ALLOWED_OFFERING_STATUSES = [
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export async function GET(req: NextRequest) {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        { error: "Faculty account is not linked to a faculty record." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("sessionToken")?.value || "";

    const sessionCheck = await validateFacultySession(sessionToken);

    if (!sessionCheck.valid) {
      return NextResponse.json(
        { error: sessionCheck.message || "Session expired." },
        { status: 401 }
      );
    }

    const teacherId = guard.teacher_id;

    const term = await prisma.academic_terms.findFirst({
      where: {
        name: termName,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        teacher_code: true,
        full_name: true,
        designation: true,
      },
    });

    const offeredCourses = await prisma.offered_courses.findMany({
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
            academic_terms: true,
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

    const existingSelections = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacherId,
        academic_term_id: term.id,
      },
      orderBy: [{ priority_order: "asc" }, { id: "asc" }],
      include: {
        offered_courses: {
          include: {
            offerings: {
              include: {
                programs: true,
                academic_terms: true,
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
        },
      },
    });

    const windowStatus = await getFacultyChoiceWindowStatus();
    const hasFinalized = existingSelections.some((x) => x.status === "FINAL");

    const availableCourses = offeredCourses.map((course) => ({
      id: course.id,
      section: course.section,
      offeringStatus: course.offerings.status,
      programCode: course.master_courses.program.short_name,
      programName: course.master_courses.program.name,
      courseCode: course.master_courses.course_code,
      courseTitle: course.master_courses.course_title,
      batchCodes: course.offered_course_batches.map((x) => x.batches.batch_code),
      teacherCodes: course.offered_course_teachers.map(
        (x) => x.teachers?.teacher_code || "-"
      ),
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
    }));

    const selections = existingSelections.map((selection) => ({
      id: selection.id,
      offeredCourseId: selection.offered_course_id,
      priorityOrder: selection.priority_order,
      status: selection.status,
      selectedAt: selection.selected_at,
      confirmedAt: selection.confirmed_at,
      course: {
        id: selection.offered_courses.id,
        section: selection.offered_courses.section,
        offeringStatus: selection.offered_courses.offerings.status,
        programCode: selection.offered_courses.master_courses.program.short_name,
        programName: selection.offered_courses.master_courses.program.name,
        courseCode: selection.offered_courses.master_courses.course_code,
        courseTitle: selection.offered_courses.master_courses.course_title,
        batchCodes: selection.offered_courses.offered_course_batches.map(
          (x) => x.batches.batch_code
        ),
        teacherCodes: selection.offered_courses.offered_course_teachers.map(
          (x) => x.teachers?.teacher_code || "-"
        ),
        schedule: selection.offered_courses.offered_course_slots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          roomCode: slot.rooms?.room_code || "-",
        })),
        linkedSecondaryCourses:
          selection.offered_courses.secondary_offered_courses.map((secondary) => ({
            id: secondary.id,
            courseCode: secondary.master_courses.course_code,
            courseTitle: secondary.master_courses.course_title,
            section: secondary.section,
            programCode: secondary.master_courses.program.short_name,
            batchCodes: secondary.offered_course_batches.map((x) => x.batches.batch_code),
          })),
      },
    }));

    return NextResponse.json({
      success: true,
      teacher,
      term: {
        id: term.id,
        name: term.name,
      },
      windowStatus,
      sessionRemainingMinutes: getRemainingMinutes(sessionCheck.session!.expiresAt),
      canEdit: windowStatus === "OPEN" && !hasFinalized,
      hasFinalized,
      availableCourses,
      selections,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculty course choice options." },
      { status: 500 }
    );
  }
}
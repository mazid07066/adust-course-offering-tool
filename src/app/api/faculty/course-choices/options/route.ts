import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import { cookies } from "next/headers";
import { validateFacultySession, getRemainingMinutes } from "@/lib/faculty-session";
import {
  getFacultyChoiceWindowStatus,
  getFacultyLevelCreditPolicy,
  getActiveFacultySeniorityLevel,
} from "@/lib/system-settings";

const FACULTY_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
];

function sumDistinctCourseCredits(
  rows: Array<{
    offered_course_id: number;
    offered_courses: {
      master_courses: {
        credit: number;
      };
    };
  }>
) {
  const seen = new Set<number>();
  let total = 0;

  for (const row of rows) {
    if (seen.has(row.offered_course_id)) continue;
    seen.add(row.offered_course_id);
    total += Number(row.offered_courses.master_courses.credit || 0);
  }

  return total;
}

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
    const sessionToken = cookieStore.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Faculty session token is missing." },
        { status: 401 }
      );
    }

    const sessionCheck = await validateFacultySession(sessionToken);

    if (!sessionCheck.valid) {
      return NextResponse.json(
        { error: sessionCheck.message || "Session expired. Please login again." },
        { status: 401 }
      );
    }

    const teacher = await prisma.teachers.findUnique({
      where: { id: guard.teacher_id },
      select: {
        id: true,
        teacher_code: true,
        full_name: true,
        designation: true,
        seniority_level: true,
        departments: {
          select: {
            short_name: true,
            name: true,
          },
        },
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "Faculty record not found." },
        { status: 404 }
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

    const windowStatus = await getFacultyChoiceWindowStatus();
    const activeSeniorityLevel = await getActiveFacultySeniorityLevel();
    const creditPolicy = await getFacultyLevelCreditPolicy(teacher.seniority_level);

    const seniorityAllowed =
      !activeSeniorityLevel ||
      teacher.seniority_level === null ||
      teacher.seniority_level === activeSeniorityLevel;

    const availableCourses = seniorityAllowed
      ? await prisma.offered_courses.findMany({
          where: {
            primary_offered_course_id: null,
            offerings: {
              academic_term_id: term.id,
              status: {
                in: FACULTY_VISIBLE_OFFERING_STATUSES,
              },
            },
          },
          orderBy: [
            { section: "asc" },
            { id: "asc" },
          ],
          include: {
            offerings: {
              select: {
                status: true,
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
            offered_course_teachers: {
              include: {
                teachers: true,
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
        })
      : [];

    const selections = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
      },
      orderBy: [{ priority_order: "asc" }, { id: "asc" }],
      include: {
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
            offered_course_teachers: {
              include: {
                teachers: true,
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
    });

    const currentSelectedCredits = sumDistinctCourseCredits(selections);
    const hasFinalized = selections.some((row) => row.status === "FINAL");

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        teacher_code: teacher.teacher_code,
        full_name: teacher.full_name,
        designation: teacher.designation,
        department_code: teacher.departments?.short_name || null,
        seniority_level: teacher.seniority_level,
      },
      term: {
        id: term.id,
        name: term.name,
      },
      windowStatus,
      activeSeniorityLevel,
      seniorityAllowed,
      sessionRemainingMinutes: getRemainingMinutes(sessionCheck.session.expiresAt),
      canEdit:
        seniorityAllowed &&
        windowStatus === "OPEN" &&
        !hasFinalized &&
        availableCourses.some(
          (row) => row.offerings.status === "FACULTY_CHOICE_BUFFER"
        ),
      hasFinalized,
      creditPolicy,
      currentSelectedCredits,
      availableCourses: availableCourses.map((course) => ({
        id: course.id,
        section: course.section,
        offeringStatus: course.offerings.status,
        programCode: course.master_courses.program.short_name,
        programName: course.master_courses.program.name,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        credit: Number(course.master_courses.credit || 0),
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
      })),
      selections: selections.map((selection) => ({
        id: selection.id,
        offeredCourseId: selection.offered_course_id,
        priorityOrder: selection.priority_order,
        status: selection.status,
        selectedAt: selection.selected_at ? selection.selected_at.toISOString() : null,
        confirmedAt: selection.confirmed_at ? selection.confirmed_at.toISOString() : null,
        course: {
          id: selection.offered_courses.id,
          section: selection.offered_courses.section,
          offeringStatus: selection.offered_courses.offerings.status,
          programCode: selection.offered_courses.master_courses.program.short_name,
          programName: selection.offered_courses.master_courses.program.name,
          courseCode: selection.offered_courses.master_courses.course_code,
          courseTitle: selection.offered_courses.master_courses.course_title,
          credit: Number(selection.offered_courses.master_courses.credit || 0),
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
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculty course choice options." },
      { status: 500 }
    );
  }
}
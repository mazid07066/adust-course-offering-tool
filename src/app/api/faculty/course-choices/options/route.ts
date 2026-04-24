import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import {
  validateFacultySession,
  getRemainingMinutes,
  processFacultySessionWarningsAndExpiry,
} from "@/lib/faculty-session";
import { canFacultyEdit } from "@/lib/faculty-access";
import {
  getFacultyChoiceWindowStatus,
  getFacultyLevelCreditPolicy,
} from "@/lib/system-settings";
import { getCurrentActiveFacultyTurn } from "@/lib/faculty-turn";

const FACULTY_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
];

type TeacherLite = {
  teacher_id: number;
  assigned_credit?: number | null;
  teachers?: {
    teacher_code: string;
    full_name: string;
  } | null;
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sumDistinctCreditsByCourse(
  rows: Array<{
    offered_course_id: number;
    credit: number;
  }>
) {
  const seen = new Set<number>();
  let total = 0;

  for (const row of rows) {
    if (seen.has(row.offered_course_id)) continue;
    seen.add(row.offered_course_id);
    total += Number(row.credit || 0);
  }

  return Number(total.toFixed(2));
}

function overlaps(
  a: { dayOfWeek: string; startTime: string; endTime: string },
  b: { dayOfWeek: string; startTime: string; endTime: string }
) {
  if (a.dayOfWeek.toUpperCase() !== b.dayOfWeek.toUpperCase()) return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
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

let termName = String(searchParams.get("termName") || "")
  .trim()
  .toUpperCase();

if (!termName) {
  const latestVisibleOffering = await prisma.offerings.findFirst({
    where: {
      status: {
        in: FACULTY_VISIBLE_OFFERING_STATUSES,
      },
    },
    orderBy: [{ academic_term_id: "desc" }, { id: "desc" }],
    include: {
      academic_terms: {
        select: {
          name: true,
        },
      },
    },
  });

  termName = latestVisibleOffering?.academic_terms?.name || "SUMMER 2026";
}

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Faculty session token missing." },
        { status: 401 }
      );
    }

    const sessionCheck = await validateFacultySession(sessionToken);

    if (!sessionCheck.valid || !sessionCheck.session) {
      return NextResponse.json(
        { error: sessionCheck.message || "Session expired." },
        { status: 401 }
      );
    }

    await processFacultySessionWarningsAndExpiry(sessionToken);

    const teacherId = guard.teacher_id;

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

    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
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
        { error: "Faculty record is missing." },
        { status: 404 }
      );
    }

    const windowStatus = await getFacultyChoiceWindowStatus();
    const editAccess = await canFacultyEdit(sessionToken, {
      id: teacher.id,
      seniority_level: teacher.seniority_level,
    });
    const activeTurn = await getCurrentActiveFacultyTurn();
    const creditPolicy = await getFacultyLevelCreditPolicy(
      teacher.seniority_level
    );

    const selections = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacherId,
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
            offered_course_slots: {
              include: {
                rooms: true,
              },
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
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

    const preassignedRows = await prisma.offered_course_teachers.findMany({
      where: {
        teacher_id: teacherId,
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
          },
        },
      },
      include: {
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_slots: {
              include: {
                rooms: true,
              },
            },
          },
        },
      },
    });

    const preassignedCourseIds = new Set(
      preassignedRows.map((row) => row.offered_course_id)
    );

    const finalMarker = await prisma.systemSetting.findUnique({
  where: {
    settingKey: `FACULTY_FINALIZED_TERM_${term.id}_TEACHER_${teacherId}`,
  },
  select: {
    settingValue: true,
  },
});

const hasFinalizedMarker = finalMarker?.settingValue === "true";


    const bufferedOrFinalSelections = selections.filter(
      (row) => row.status === "BUFFER" || row.status === "FINAL"
    );

    const selectedCourseIds = new Set(
      bufferedOrFinalSelections.map((row) => row.offered_course_id)
    );

    const preassignedCredits = sumDistinctCreditsByCourse(
      preassignedRows.map((row) => ({
        offered_course_id: row.offered_course_id,
        credit: Number(row.offered_courses.master_courses.credit || 0),
      }))
    );

    const chosenCredits = sumDistinctCreditsByCourse(
      bufferedOrFinalSelections.map((row) => ({
        offered_course_id: row.offered_course_id,
        credit: Number(row.offered_courses.master_courses.credit || 0),
      }))
    );

    const combinedCurrentCredits = Number(
      (preassignedCredits + chosenCredits).toFixed(2)
    );

    const occupiedSchedules = [
      ...preassignedRows.flatMap((row) =>
        row.offered_courses.offered_course_slots.map((slot) => ({
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
        }))
      ),
      ...bufferedOrFinalSelections.flatMap((row) =>
        row.offered_courses.offered_course_slots.map((slot) => ({
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
        }))
      ),
    ];

    const offeredCourses = await prisma.offered_courses.findMany({
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
          include: {
            rooms: true,
          },
          orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
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
        faculty_course_selections: {
          where: {
            academic_term_id: term.id,
          },
          select: {
            teacher_id: true,
            status: true,
          },
        },
      },
    });

    const availableCourses = offeredCourses.map((course) => {
      const assignedTeachers = (course.offered_course_teachers || []) as TeacherLite[];

      const assignedTeacherIds = assignedTeachers.map((row) => row.teacher_id);

      const assignedTeacherCodes = uniqueStrings(
        assignedTeachers.map((row) => row.teachers?.teacher_code || "")
      );

      const assignedTeacherText = uniqueStrings(
        assignedTeachers.map((row) =>
          row.teachers?.teacher_code && row.teachers?.full_name
            ? `${row.teachers.teacher_code} - ${row.teachers.full_name}`
            : ""
        )
      );

      const isPreassigned = assignedTeacherIds.length > 0;
      const isPreassignedToCurrentFaculty = assignedTeacherIds.includes(teacherId);
      const isPreassignedToAnotherFaculty =
        isPreassigned && !isPreassignedToCurrentFaculty;

      const isInMyBufferOrFinal = selectedCourseIds.has(course.id);
      const isAlreadyInMyOfficialLoad = preassignedCourseIds.has(course.id);

      const othersFinal = course.faculty_course_selections.find(
        (row) => row.teacher_id !== teacherId && row.status === "FINAL"
      );

      const othersBufferCount = course.faculty_course_selections.filter(
        (row) => row.teacher_id !== teacherId && row.status === "BUFFER"
      ).length;

      const schedule = course.offered_course_slots.map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        roomCode:
          (slot.rooms as unknown as { room_number?: string | number | null })
            ?.room_number !== undefined &&
          (slot.rooms as unknown as { room_number?: string | number | null })
            ?.room_number !== null
            ? String(
                (slot.rooms as unknown as { room_number?: string | number | null })
                  .room_number
              )
            : slot.rooms?.room_code || "-",
      }));

      let selectionState:
        | "FREE"
        | "YOU_BUFFER"
        | "YOU_FINAL"
        | "YOU_PREASSIGNED"
        | "TAKEN_FINAL"
        | "BUFFERED_BY_OTHERS" = "FREE";

      const mySelection = selections.find(
        (row) => row.offered_course_id === course.id
      );

      if (isAlreadyInMyOfficialLoad) {
        selectionState = "YOU_PREASSIGNED";
      } else if (mySelection?.status === "FINAL") {
        selectionState = "YOU_FINAL";
      } else if (mySelection?.status === "BUFFER") {
        selectionState = "YOU_BUFFER";
      } else if (othersFinal) {
        selectionState = "TAKEN_FINAL";
      } else if (othersBufferCount > 0) {
        selectionState = "BUFFERED_BY_OTHERS";
      }

      let locked = false;
      let lockReason = "";

      if (isPreassignedToAnotherFaculty) {
        locked = true;
        lockReason = "Already preassigned to another faculty.";
      } else if (isAlreadyInMyOfficialLoad) {
        locked = true;
        lockReason = "Already preassigned to you.";
      } else if (selectionState === "TAKEN_FINAL") {
        locked = true;
        lockReason = "Already finalized by another faculty.";
      } else {
        const hasScheduleConflict = schedule.some((slot) =>
          occupiedSchedules.some((occupied) => overlaps(slot, occupied))
        );

        if (!isInMyBufferOrFinal && hasScheduleConflict) {
          locked = true;
          lockReason =
            "Conflicts with your existing preassigned/buffered/finalized load.";
        }
      }

      return {
        id: course.id,
        section: course.section,
        offeringStatus: course.offerings.status,
        programCode: course.master_courses.program.short_name,
        programName: course.master_courses.program.name,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        credit: Number(course.master_courses.credit || 0),
        batchCodes: course.offered_course_batches.map((x) => x.batches.batch_code),
        teacherCodes: assignedTeacherCodes,
        teacherText: assignedTeacherText,
        schedule,
        linkedSecondaryCourses: course.secondary_offered_courses.map((secondary) => ({
          id: secondary.id,
          courseCode: secondary.master_courses.course_code,
          courseTitle: secondary.master_courses.course_title,
          section: secondary.section,
          programCode: secondary.master_courses.program.short_name,
          batchCodes: secondary.offered_course_batches.map((x) => x.batches.batch_code),
        })),
        selectionState,
        isPreassigned,
        isPreassignedToCurrentFaculty,
        isPreassignedToAnotherFaculty,
        locked,
        lockReason,
        bufferedByOthersCount: othersBufferCount,
      };
    });

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        teacher_code: teacher.teacher_code,
        full_name: teacher.full_name,
        designation: teacher.designation,
        department_code: teacher.departments?.short_name || "",
        seniority_level: teacher.seniority_level,
      },
      term: {
        id: term.id,
        name: term.name,
      },
      windowStatus,
      activeTurn: activeTurn
        ? {
            teacherId: activeTurn.teacherId,
            teacherCode: activeTurn.teacherCode,
            fullName: activeTurn.fullName,
            seniorityLevel: activeTurn.seniorityLevel,
          }
        : null,
      canEdit: editAccess.allowed,
      editMessage: editAccess.allowed ? "" : editAccess.message,
      hasFinalized:
  hasFinalizedMarker || selections.some((row) => row.status === "FINAL"),
      creditPolicy,
      preassignedCredits,
      chosenCredits,
      combinedCurrentCredits,
      currentSelectedCredits: combinedCurrentCredits,
      remainingSelectableCredits:
        creditPolicy?.maxCredits !== null &&
        creditPolicy?.maxCredits !== undefined
          ? Number((creditPolicy.maxCredits - preassignedCredits).toFixed(2))
          : null,
      sessionRemainingMinutes: getRemainingMinutes(sessionCheck.session.expires_at),
      availableCourses,
      selections: selections.map((selection) => ({
        id: selection.id,
        offeredCourseId: selection.offered_course_id,
        priorityOrder: selection.priority_order,
        status: selection.status,
        selectedAt: selection.selected_at
          ? selection.selected_at.toISOString()
          : null,
        confirmedAt: selection.confirmed_at
          ? selection.confirmed_at.toISOString()
          : null,
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
        },
      })),
      preassignedCourses: preassignedRows.map((assignment) => ({
        offeredCourseId: assignment.offered_course_id,
        assignedCredit: Number(assignment.assigned_credit || 0),
        loadType: assignment.load_type,
        course: {
          id: assignment.offered_courses.id,
          section: assignment.offered_courses.section,
          courseCode: assignment.offered_courses.master_courses.course_code,
          courseTitle: assignment.offered_courses.master_courses.course_title,
          credit: Number(assignment.offered_courses.master_courses.credit || 0),
        },
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load faculty course choice options.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";
import {
  validateFacultySession,
  getRemainingMinutes,
  processFacultySessionWarningsAndExpiry,
} from "@/lib/faculty-session";
import {
  getFacultyChoiceWindowStatus,
  getFacultyLevelCreditPolicy,
} from "@/lib/system-settings";
import { getCurrentActiveFacultyTurn } from "@/lib/faculty-turn";

const FACULTY_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
] as const;

type OfferedCourseBaseRow = {
  id: number;
  section: string;
  offering_status: string;
  course_code: string;
  course_title: string;
  credit: unknown;
  program_code: string;
  program_name: string;
};

type OfferedCourseBatchRow = {
  offered_course_id: number;
  batch_code: string;
};

type OfferedCourseSlotRow = {
  id: number;
  offered_course_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_code: string | null;
};

type OfferedCourseTeacherRow = {
  offered_course_id: number;
  teacher_id: number;
  assigned_credit: unknown;
  teacher_code: string | null;
  full_name: string | null;
};

type SecondaryCourseRow = {
  primary_offered_course_id: number;
  id: number;
  section: string;
  course_code: string;
  course_title: string;
  program_code: string;
  batch_code: string | null;
};

type CourseSelectionStateRow = {
  offered_course_id: number;
  teacher_id: number;
  status: string;
};

type ScheduleItem = {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomCode: string;
};

type SecondaryCourseItem = {
  id: number;
  courseCode: string;
  courseTitle: string;
  section: string;
  programCode: string;
  batchCodes: string[];
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
    if (seen.has(row.offered_course_id)) {
      continue;
    }

    seen.add(row.offered_course_id);
    total += Number(row.credit || 0);
  }

  return Number(total.toFixed(2));
}

function overlaps(
  a: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  },
  b: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }
) {
  if (a.dayOfWeek.toUpperCase() !== b.dayOfWeek.toUpperCase()) {
    return false;
  }

  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function pushMapArray<K, V>(
  map: Map<K, V[]>,
  key: K,
  value: V
) {
  const current = map.get(key);

  if (current) {
    current.push(value);
    return;
  }

  map.set(key, [value]);
}

async function loadAvailableCourseDataset(termId: number) {
  const bufferStatus = FACULTY_VISIBLE_OFFERING_STATUSES[0];
  const finalizedStatus = FACULTY_VISIBLE_OFFERING_STATUSES[1];

  /*
   * Prisma relation includes are intentionally not used here.
   *
   * For the faculty course pool, the previous relation tree resulted
   * in many sequential SQL round trips:
   *
   * offered courses
   * offerings
   * programs
   * master courses
   * batches
   * slots
   * rooms
   * teachers
   * secondary courses
   * secondary batches
   * faculty selections
   *
   * The database is remote, so round-trip count matters much more than
   * the small amount of returned data.
   *
   * These compact flat queries can execute concurrently and are joined
   * in memory below.
   */
  const [
    baseRows,
    batchRows,
    slotRows,
    teacherRows,
    secondaryRows,
    selectionStateRows,
  ] = await Promise.all([
    prisma.$queryRaw<OfferedCourseBaseRow[]>`
      SELECT
        oc.id,
        oc.section,
        o.status AS offering_status,
        mc.course_code,
        mc.course_title,
        mc.credit,
        p.short_name AS program_code,
        p.name AS program_name
      FROM offered_courses AS oc
      INNER JOIN offerings AS o
        ON o.id = oc.offering_id
      INNER JOIN master_courses AS mc
        ON mc.id = oc.master_course_id
      INNER JOIN programs AS p
        ON p.id = mc.program_id
      WHERE
        oc.primary_offered_course_id IS NULL
        AND o.academic_term_id = ${termId}
        AND o.status IN (${bufferStatus}, ${finalizedStatus})
      ORDER BY
        o.program_id ASC,
        oc.section ASC,
        oc.id ASC
    `,

    prisma.$queryRaw<OfferedCourseBatchRow[]>`
      SELECT
        ocb.offered_course_id,
        b.batch_code
      FROM offered_course_batches AS ocb
      INNER JOIN batches AS b
        ON b.id = ocb.batch_id
      INNER JOIN offered_courses AS oc
        ON oc.id = ocb.offered_course_id
      INNER JOIN offerings AS o
        ON o.id = oc.offering_id
      WHERE
        oc.primary_offered_course_id IS NULL
        AND o.academic_term_id = ${termId}
        AND o.status IN (${bufferStatus}, ${finalizedStatus})
      ORDER BY
        ocb.offered_course_id ASC,
        b.batch_code ASC
    `,

    prisma.$queryRaw<OfferedCourseSlotRow[]>`
      SELECT
        s.id,
        s.offered_course_id,
        s.day_of_week,
        s.start_time,
        s.end_time,
        r.room_code
      FROM offered_course_slots AS s
      INNER JOIN offered_courses AS oc
        ON oc.id = s.offered_course_id
      INNER JOIN offerings AS o
        ON o.id = oc.offering_id
      LEFT JOIN rooms AS r
        ON r.id = s.room_id
      WHERE
        oc.primary_offered_course_id IS NULL
        AND o.academic_term_id = ${termId}
        AND o.status IN (${bufferStatus}, ${finalizedStatus})
      ORDER BY
        s.offered_course_id ASC,
        s.day_of_week ASC,
        s.start_time ASC
    `,

    prisma.$queryRaw<OfferedCourseTeacherRow[]>`
      SELECT
        oct.offered_course_id,
        oct.teacher_id,
        oct.assigned_credit,
        t.teacher_code,
        t.full_name
      FROM offered_course_teachers AS oct
      INNER JOIN offered_courses AS oc
        ON oc.id = oct.offered_course_id
      INNER JOIN offerings AS o
        ON o.id = oc.offering_id
      LEFT JOIN teachers AS t
        ON t.id = oct.teacher_id
      WHERE
        oc.primary_offered_course_id IS NULL
        AND o.academic_term_id = ${termId}
        AND o.status IN (${bufferStatus}, ${finalizedStatus})
      ORDER BY
        oct.offered_course_id ASC,
        oct.id ASC
    `,

    prisma.$queryRaw<SecondaryCourseRow[]>`
      SELECT
        secondary.primary_offered_course_id,
        secondary.id,
        secondary.section,
        mc.course_code,
        mc.course_title,
        p.short_name AS program_code,
        b.batch_code
      FROM offered_courses AS secondary
      INNER JOIN offered_courses AS primary_course
        ON primary_course.id = secondary.primary_offered_course_id
      INNER JOIN offerings AS primary_offering
        ON primary_offering.id = primary_course.offering_id
      INNER JOIN master_courses AS mc
        ON mc.id = secondary.master_course_id
      INNER JOIN programs AS p
        ON p.id = mc.program_id
      LEFT JOIN offered_course_batches AS ocb
        ON ocb.offered_course_id = secondary.id
      LEFT JOIN batches AS b
        ON b.id = ocb.batch_id
      WHERE
        primary_offering.academic_term_id = ${termId}
        AND primary_offering.status IN (${bufferStatus}, ${finalizedStatus})
      ORDER BY
        secondary.primary_offered_course_id ASC,
        secondary.id ASC,
        b.batch_code ASC
    `,

    prisma.$queryRaw<CourseSelectionStateRow[]>`
      SELECT
        fcs.offered_course_id,
        fcs.teacher_id,
        fcs.status
      FROM faculty_course_selections AS fcs
      INNER JOIN offered_courses AS oc
        ON oc.id = fcs.offered_course_id
      INNER JOIN offerings AS o
        ON o.id = oc.offering_id
      WHERE
        fcs.academic_term_id = ${termId}
        AND oc.primary_offered_course_id IS NULL
        AND o.academic_term_id = ${termId}
        AND o.status IN (${bufferStatus}, ${finalizedStatus})
      ORDER BY
        fcs.offered_course_id ASC,
        fcs.id ASC
    `,
  ]);

  const batchesByCourse = new Map<number, string[]>();
  const slotsByCourse = new Map<number, ScheduleItem[]>();
  const teachersByCourse =
    new Map<number, OfferedCourseTeacherRow[]>();
  const selectionsByCourse =
    new Map<number, CourseSelectionStateRow[]>();

  const secondaryByPrimary =
    new Map<number, SecondaryCourseItem[]>();

  for (const row of batchRows) {
    pushMapArray(
      batchesByCourse,
      row.offered_course_id,
      row.batch_code
    );
  }

  for (const row of slotRows) {
    pushMapArray(
      slotsByCourse,
      row.offered_course_id,
      {
        id: row.id,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time,
        roomCode: row.room_code || "-",
      }
    );
  }

  for (const row of teacherRows) {
    pushMapArray(
      teachersByCourse,
      row.offered_course_id,
      row
    );
  }

  for (const row of selectionStateRows) {
    pushMapArray(
      selectionsByCourse,
      row.offered_course_id,
      row
    );
  }

  const secondaryCourseMaps =
    new Map<
      number,
      Map<number, SecondaryCourseItem>
    >();

  for (const row of secondaryRows) {
    let courseMap =
      secondaryCourseMaps.get(
        row.primary_offered_course_id
      );

    if (!courseMap) {
      courseMap =
        new Map<number, SecondaryCourseItem>();

      secondaryCourseMaps.set(
        row.primary_offered_course_id,
        courseMap
      );
    }

    let item = courseMap.get(row.id);

    if (!item) {
      item = {
        id: row.id,
        courseCode: row.course_code,
        courseTitle: row.course_title,
        section: row.section,
        programCode: row.program_code,
        batchCodes: [],
      };

      courseMap.set(row.id, item);
    }

    if (
      row.batch_code &&
      !item.batchCodes.includes(row.batch_code)
    ) {
      item.batchCodes.push(row.batch_code);
    }
  }

  for (
    const [primaryCourseId, courseMap]
    of secondaryCourseMaps
  ) {
    secondaryByPrimary.set(
      primaryCourseId,
      Array.from(courseMap.values())
    );
  }

  return {
    baseRows,
    batchesByCourse,
    slotsByCourse,
    teachersByCourse,
    selectionsByCourse,
    secondaryByPrimary,
  };
}

export async function GET(req: NextRequest) {
  const guard = await requireFacultyApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        {
          error:
            "Faculty account is not linked to a faculty record.",
        },
        {
          status: 400,
        }
      );
    }

    const teacherId = guard.teacher_id;

    const { searchParams } = new URL(req.url);

    let termName = String(
      searchParams.get("termName") || ""
    )
      .trim()
      .toUpperCase();

    if (!termName) {
      const latestVisibleOffering =
        await prisma.offerings.findFirst({
          where: {
            status: {
              in: [
                ...FACULTY_VISIBLE_OFFERING_STATUSES,
              ],
            },
          },

          orderBy: [
            {
              academic_term_id: "desc",
            },
            {
              id: "desc",
            },
          ],

          select: {
            academic_terms: {
              select: {
                name: true,
              },
            },
          },
        });

      termName =
        latestVisibleOffering
          ?.academic_terms?.name ||
        "SUMMER 2026";
    }

    const cookieStore = await cookies();

    const sessionToken =
      cookieStore.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          error:
            "Faculty session token missing.",
        },
        {
          status: 401,
        }
      );
    }

    const sessionProcessing =
      await processFacultySessionWarningsAndExpiry(
        sessionToken
      );

    if (
      !sessionProcessing.ok ||
      sessionProcessing.expired
    ) {
      return NextResponse.json(
        {
          error:
            sessionProcessing.message ||
            "Faculty session has expired.",
        },
        {
          status: 401,
        }
      );
    }

    const sessionCheck =
      await validateFacultySession(
        sessionToken
      );

    if (
      !sessionCheck.valid ||
      !sessionCheck.session
    ) {
      return NextResponse.json(
        {
          error:
            sessionCheck.message ||
            "Session expired.",
        },
        {
          status: 401,
        }
      );
    }

    const [term, teacher] =
      await Promise.all([
        prisma.academic_terms.findFirst({
          where: {
            name: termName,
          },

          select: {
            id: true,
            name: true,
          },
        }),

        prisma.teachers.findUnique({
          where: {
            id: teacherId,
          },

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
        }),
      ]);

    if (!term) {
      return NextResponse.json(
        {
          error:
            "Academic term not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (!teacher) {
      return NextResponse.json(
        {
          error:
            "Faculty record is missing.",
        },
        {
          status: 404,
        }
      );
    }

    const [
      windowStatus,
      creditPolicy,
    ] = await Promise.all([
      getFacultyChoiceWindowStatus(),

      getFacultyLevelCreditPolicy(
        teacher.seniority_level
      ),
    ]);

    const activeTurn =
      windowStatus === "OPEN"
        ? await getCurrentActiveFacultyTurn()
        : null;

    let editAccess: {
      allowed: boolean;
      message: string;
    };

    if (windowStatus !== "OPEN") {
      editAccess = {
        allowed: false,
        message:
          "Faculty choice window is not open right now.",
      };
    } else if (!activeTurn) {
      editAccess = {
        allowed: false,
        message:
          "No active faculty turn is available right now.",
      };
    } else if (
      activeTurn.teacherId !== teacher.id
    ) {
      editAccess = {
        allowed: false,
        message:
          `Current active turn belongs to ${activeTurn.teacherCode} - ${activeTurn.fullName}.`,
      };
    } else {
      editAccess = {
        allowed: true,
        message: "",
      };
    }

    const [
      selections,
      preassignedRows,
      finalMarker,
      availableDataset,
    ] = await Promise.all([
      prisma.faculty_course_selections.findMany({
        where: {
          teacher_id: teacherId,
          academic_term_id: term.id,
        },

        orderBy: [
          {
            priority_order: "asc",
          },
          {
            id: "asc",
          },
        ],

        select: {
          id: true,
          offered_course_id: true,
          priority_order: true,
          status: true,
          selected_at: true,
          confirmed_at: true,

          offered_courses: {
            select: {
              id: true,
              section: true,

              offerings: {
                select: {
                  status: true,
                },
              },

              master_courses: {
                select: {
                  course_code: true,
                  course_title: true,
                  credit: true,

                  program: {
                    select: {
                      short_name: true,
                      name: true,
                    },
                  },
                },
              },

              offered_course_batches: {
                select: {
                  batches: {
                    select: {
                      batch_code: true,
                    },
                  },
                },
              },

              offered_course_slots: {
                orderBy: [
                  {
                    day_of_week: "asc",
                  },
                  {
                    start_time: "asc",
                  },
                ],

                select: {
                  id: true,
                  day_of_week: true,
                  start_time: true,
                  end_time: true,

                  rooms: {
                    select: {
                      room_code: true,
                    },
                  },
                },
              },

              offered_course_teachers: {
                select: {
                  teacher_id: true,

                  teachers: {
                    select: {
                      teacher_code: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),

      prisma.offered_course_teachers.findMany({
        where: {
          teacher_id: teacherId,

          offered_courses: {
            offerings: {
              academic_term_id: term.id,
            },
          },
        },

        select: {
          offered_course_id: true,
          assigned_credit: true,
          load_type: true,

          offered_courses: {
            select: {
              id: true,
              section: true,

              master_courses: {
                select: {
                  course_code: true,
                  course_title: true,
                  credit: true,
                },
              },

              offered_course_slots: {
                select: {
                  id: true,
                  day_of_week: true,
                  start_time: true,
                  end_time: true,
                },
              },
            },
          },
        },
      }),

      prisma.systemSetting.findUnique({
        where: {
          settingKey:
            `FACULTY_FINALIZED_TERM_${term.id}_TEACHER_${teacherId}`,
        },

        select: {
          settingValue: true,
        },
      }),

      loadAvailableCourseDataset(term.id),
    ]);

    const hasFinalizedMarker =
      finalMarker?.settingValue === "true";

    const bufferedOrFinalSelections =
      selections.filter(
        (row) =>
          row.status === "BUFFER" ||
          row.status === "FINAL"
      );

    const selectedCourseIds =
      new Set(
        bufferedOrFinalSelections.map(
          (row) =>
            row.offered_course_id
        )
      );

    const preassignedCourseIds =
      new Set(
        preassignedRows.map(
          (row) =>
            row.offered_course_id
        )
      );

    const selectionByCourseId =
      new Map(
        selections.map((row) => [
          row.offered_course_id,
          row,
        ])
      );

    const preassignedCredits =
      sumDistinctCreditsByCourse(
        preassignedRows.map((row) => ({
          offered_course_id:
            row.offered_course_id,

          credit: Number(
            row.offered_courses
              .master_courses.credit || 0
          ),
        }))
      );

    const chosenCredits =
      sumDistinctCreditsByCourse(
        bufferedOrFinalSelections.map(
          (row) => ({
            offered_course_id:
              row.offered_course_id,

            credit: Number(
              row.offered_courses
                .master_courses.credit || 0
            ),
          })
        )
      );

    const combinedCurrentCredits =
      Number(
        (
          preassignedCredits +
          chosenCredits
        ).toFixed(2)
      );

    const occupiedSchedules = [
      ...preassignedRows.flatMap(
        (row) =>
          row.offered_courses
            .offered_course_slots.map(
              (slot) => ({
                dayOfWeek:
                  slot.day_of_week,
                startTime:
                  slot.start_time,
                endTime:
                  slot.end_time,
              })
            )
      ),

      ...bufferedOrFinalSelections.flatMap(
        (row) =>
          row.offered_courses
            .offered_course_slots.map(
              (slot) => ({
                dayOfWeek:
                  slot.day_of_week,
                startTime:
                  slot.start_time,
                endTime:
                  slot.end_time,
              })
            )
      ),
    ];

    const availableCourses =
      availableDataset.baseRows.map(
        (course) => {
          const assignedTeachers =
            availableDataset
              .teachersByCourse
              .get(course.id) || [];

          const assignedTeacherIds =
            assignedTeachers.map(
              (row) => row.teacher_id
            );

          const assignedTeacherCodes =
            uniqueStrings(
              assignedTeachers.map(
                (row) =>
                  row.teacher_code || ""
              )
            );

          const assignedTeacherText =
            uniqueStrings(
              assignedTeachers.map(
                (row) =>
                  row.teacher_code &&
                  row.full_name
                    ? `${row.teacher_code} - ${row.full_name}`
                    : ""
              )
            );

          const isPreassigned =
            assignedTeacherIds.length > 0;

          const isPreassignedToCurrentFaculty =
            assignedTeacherIds.includes(
              teacherId
            );

          const isPreassignedToAnotherFaculty =
            isPreassigned &&
            !isPreassignedToCurrentFaculty;

          const isInMyBufferOrFinal =
            selectedCourseIds.has(
              course.id
            );

          const isAlreadyInMyOfficialLoad =
            preassignedCourseIds.has(
              course.id
            );

          const courseSelectionStates =
            availableDataset
              .selectionsByCourse
              .get(course.id) || [];

          const othersFinal =
            courseSelectionStates.find(
              (row) =>
                row.teacher_id !==
                  teacherId &&
                row.status === "FINAL"
            );

          const othersBufferCount =
            courseSelectionStates.filter(
              (row) =>
                row.teacher_id !==
                  teacherId &&
                row.status === "BUFFER"
            ).length;

          const schedule =
            availableDataset
              .slotsByCourse
              .get(course.id) || [];

          let selectionState:
            | "FREE"
            | "YOU_BUFFER"
            | "YOU_FINAL"
            | "YOU_PREASSIGNED"
            | "TAKEN_FINAL"
            | "BUFFERED_BY_OTHERS" =
            "FREE";

          const mySelection =
            selectionByCourseId.get(
              course.id
            );

          if (
            isAlreadyInMyOfficialLoad
          ) {
            selectionState =
              "YOU_PREASSIGNED";
          } else if (
            mySelection?.status ===
            "FINAL"
          ) {
            selectionState =
              "YOU_FINAL";
          } else if (
            mySelection?.status ===
            "BUFFER"
          ) {
            selectionState =
              "YOU_BUFFER";
          } else if (othersFinal) {
            selectionState =
              "TAKEN_FINAL";
          } else if (
            othersBufferCount > 0
          ) {
            selectionState =
              "BUFFERED_BY_OTHERS";
          }

          let locked = false;
          let lockReason = "";

          if (
            isPreassignedToAnotherFaculty
          ) {
            locked = true;
            lockReason =
              "Already preassigned to another faculty.";
          } else if (
            isAlreadyInMyOfficialLoad
          ) {
            locked = true;
            lockReason =
              "Already preassigned to you.";
          } else if (
            selectionState ===
            "TAKEN_FINAL"
          ) {
            locked = true;
            lockReason =
              "Already finalized by another faculty.";
          } else {
            const hasScheduleConflict =
              schedule.some((slot) =>
                occupiedSchedules.some(
                  (occupied) =>
                    overlaps(
                      slot,
                      occupied
                    )
                )
              );

            if (
              !isInMyBufferOrFinal &&
              hasScheduleConflict
            ) {
              locked = true;
              lockReason =
                "Conflicts with your existing preassigned/buffered/finalized load.";
            }
          }

          return {
            id: course.id,

            section: course.section,

            offeringStatus:
              course.offering_status,

            programCode:
              course.program_code,

            programName:
              course.program_name,

            courseCode:
              course.course_code,

            courseTitle:
              course.course_title,

            credit: Number(
              course.credit || 0
            ),

            batchCodes:
              availableDataset
                .batchesByCourse
                .get(course.id) || [],

            teacherCodes:
              assignedTeacherCodes,

            teacherText:
              assignedTeacherText,

            schedule,

            linkedSecondaryCourses:
              availableDataset
                .secondaryByPrimary
                .get(course.id) || [],

            selectionState,
            isPreassigned,
            isPreassignedToCurrentFaculty,
            isPreassignedToAnotherFaculty,
            locked,
            lockReason,

            bufferedByOthersCount:
              othersBufferCount,
          };
        }
      );

    return NextResponse.json({
      success: true,

      teacher: {
        id: teacher.id,
        teacher_code:
          teacher.teacher_code,
        full_name:
          teacher.full_name,
        designation:
          teacher.designation,

        department_code:
          teacher.departments
            ?.short_name || "",

        seniority_level:
          teacher.seniority_level,
      },

      term: {
        id: term.id,
        name: term.name,
      },

      windowStatus,

      activeTurn: activeTurn
        ? {
            teacherId:
              activeTurn.teacherId,

            teacherCode:
              activeTurn.teacherCode,

            fullName:
              activeTurn.fullName,

            seniorityLevel:
              activeTurn.seniorityLevel,
          }
        : null,

      canEdit:
        editAccess.allowed,

      editMessage:
        editAccess.allowed
          ? ""
          : editAccess.message,

      hasFinalized:
        hasFinalizedMarker ||
        selections.some(
          (row) =>
            row.status === "FINAL"
        ),

      creditPolicy,

      preassignedCredits,
      chosenCredits,
      combinedCurrentCredits,

      currentSelectedCredits:
        combinedCurrentCredits,

      remainingSelectableCredits:
        creditPolicy?.maxCredits !==
          null &&
        creditPolicy?.maxCredits !==
          undefined
          ? Number(
              (
                creditPolicy.maxCredits -
                preassignedCredits
              ).toFixed(2)
            )
          : null,

      sessionRemainingMinutes:
        getRemainingMinutes(
          sessionCheck.session
            .expires_at
        ),

      availableCourses,

      selections:
        selections.map(
          (selection) => ({
            id: selection.id,

            offeredCourseId:
              selection.offered_course_id,

            priorityOrder:
              selection.priority_order,

            status:
              selection.status,

            selectedAt:
              selection.selected_at
                ? selection.selected_at.toISOString()
                : null,

            confirmedAt:
              selection.confirmed_at
                ? selection.confirmed_at.toISOString()
                : null,

            course: {
              id:
                selection
                  .offered_courses.id,

              section:
                selection
                  .offered_courses
                  .section,

              offeringStatus:
                selection
                  .offered_courses
                  .offerings.status,

              programCode:
                selection
                  .offered_courses
                  .master_courses
                  .program.short_name,

              programName:
                selection
                  .offered_courses
                  .master_courses
                  .program.name,

              courseCode:
                selection
                  .offered_courses
                  .master_courses
                  .course_code,

              courseTitle:
                selection
                  .offered_courses
                  .master_courses
                  .course_title,

              credit: Number(
                selection
                  .offered_courses
                  .master_courses
                  .credit || 0
              ),

              batchCodes:
                selection
                  .offered_courses
                  .offered_course_batches.map(
                    (row) =>
                      row.batches
                        .batch_code
                  ),

              teacherCodes:
                selection
                  .offered_courses
                  .offered_course_teachers.map(
                    (row) =>
                      row.teachers
                        ?.teacher_code ||
                      "-"
                  ),

              schedule:
                selection
                  .offered_courses
                  .offered_course_slots.map(
                    (slot) => ({
                      id: slot.id,

                      dayOfWeek:
                        slot.day_of_week,

                      startTime:
                        slot.start_time,

                      endTime:
                        slot.end_time,

                      roomCode:
                        slot.rooms
                          ?.room_code ||
                        "-",
                    })
                  ),
            },
          })
        ),

      preassignedCourses:
        preassignedRows.map(
          (assignment) => ({
            offeredCourseId:
              assignment.offered_course_id,

            assignedCredit: Number(
              assignment.assigned_credit ||
                0
            ),

            loadType:
              assignment.load_type,

            course: {
              id:
                assignment
                  .offered_courses.id,

              section:
                assignment
                  .offered_courses
                  .section,

              courseCode:
                assignment
                  .offered_courses
                  .master_courses
                  .course_code,

              courseTitle:
                assignment
                  .offered_courses
                  .master_courses
                  .course_title,

              credit: Number(
                assignment
                  .offered_courses
                  .master_courses
                  .credit || 0
              ),
            },
          })
        ),
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
      {
        status: 500,
      }
    );
  }
}
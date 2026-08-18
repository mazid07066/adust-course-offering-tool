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
import { getEligibleFacultyTurnQueue } from "@/lib/faculty-turn";

const FACULTY_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
];

type VisibleOfferingPool = {
  activeTermName: string | null;
  visibleOfferingCount: number;
};

async function loadVisibleOfferingPool(
  termName: string
): Promise<VisibleOfferingPool> {
  if (termName) {
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
      return {
        activeTermName: null,
        visibleOfferingCount: 0,
      };
    }

    const visibleOfferingCount =
      await prisma.offered_courses.count({
        where: {
          primary_offered_course_id: null,
          offerings: {
            academic_term_id: term.id,
            status: {
              in: FACULTY_VISIBLE_OFFERING_STATUSES,
            },
          },
        },
      });

    return {
      activeTermName: term.name,
      visibleOfferingCount,
    };
  }

  const latestVisibleOffering =
    await prisma.offerings.findFirst({
      where: {
        status: {
          in: FACULTY_VISIBLE_OFFERING_STATUSES,
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
        id: true,
        academic_terms: {
          select: {
            name: true,
          },
        },
      },
    });

  if (!latestVisibleOffering) {
    return {
      activeTermName: null,
      visibleOfferingCount: 0,
    };
  }

  const visibleOfferingCount =
    await prisma.offered_courses.count({
      where: {
        primary_offered_course_id: null,
        offering_id: latestVisibleOffering.id,
      },
    });

  return {
    activeTermName:
      latestVisibleOffering.academic_terms?.name || null,
    visibleOfferingCount,
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
            "Faculty account is not linked to a teacher record.",
        },
        {
          status: 400,
        }
      );
    }

    const teacherId = guard.teacher_id;

    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          error:
            "Faculty session token is missing.",
        },
        {
          status: 401,
        }
      );
    }

    const { searchParams } = new URL(req.url);

    const termName = String(
      searchParams.get("termName") || ""
    )
      .trim()
      .toUpperCase();

    /*
     * Session warning/expiry processing and the faculty-record lookup
     * are independent once authentication has passed.
     */
    const [sessionProcessing, teacher] =
      await Promise.all([
        processFacultySessionWarningsAndExpiry(
          sessionToken
        ),

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

    if (
      !sessionProcessing.ok ||
      sessionProcessing.expired
    ) {
      return NextResponse.json(
        {
          error:
            sessionProcessing.message ||
            "Faculty session is invalid.",
        },
        {
          status: 401,
        }
      );
    }

    const sessionCheck =
      await validateFacultySession(sessionToken);

    if (
      !sessionCheck.valid ||
      !sessionCheck.session
    ) {
      return NextResponse.json(
        {
          error:
            sessionCheck.message ||
            "Faculty session is invalid.",
        },
        {
          status: 401,
        }
      );
    }

    if (!teacher) {
      return NextResponse.json(
        {
          error: "Faculty record not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * All operations below depend only on the already-resolved faculty
     * and session. Run them concurrently rather than paying one remote
     * database round trip after another.
     *
     * getEligibleFacultyTurnQueue() is called only once. The previous
     * route first called getCurrentActiveFacultyTurn(), which itself
     * loaded this same queue, and then loaded the queue again.
     */
    const [
      windowStatus,
      creditPolicy,
      queue,
      unreadNotificationCount,
      recentNotifications,
      visibleOfferingPool,
    ] = await Promise.all([
      getFacultyChoiceWindowStatus(),

      getFacultyLevelCreditPolicy(
        teacher.seniority_level
      ),

      getEligibleFacultyTurnQueue(),

      prisma.notifications.count({
        where: {
          is_read: false,
          OR: [
            {
              recipient_user_id: guard.id,
            },
            {
              recipient_teacher_id: teacher.id,
            },
          ],
        },
      }),

      prisma.notifications.findMany({
        where: {
          OR: [
            {
              recipient_user_id: guard.id,
            },
            {
              recipient_teacher_id: teacher.id,
            },
          ],
        },
        orderBy: [
          {
            created_at: "desc",
          },
        ],
        take: 10,
        select: {
          id: true,
          recipient_user_id: true,
          recipient_teacher_id: true,
          event_type: true,
          title: true,
          message: true,
          is_read: true,
          created_by_user_id: true,
          created_at: true,
          read_at: true,
        },
      }),

      loadVisibleOfferingPool(termName),
    ]);

    const activeTurn =
      queue.length > 0 ? queue[0] : null;

    const canActNow =
      activeTurn?.teacherId === teacher.id;

    return NextResponse.json({
      success: true,

      teacher: {
        id: teacher.id,
        teacherCode: teacher.teacher_code,
        fullName: teacher.full_name,
        designation: teacher.designation,
        departmentCode:
          teacher.departments?.short_name || null,
        departmentName:
          teacher.departments?.name || null,
        seniorityLevel:
          teacher.seniority_level,
      },

      policy: {
        windowStatus,
        canActNow,
        creditPolicy,
      },

      activeTurn: activeTurn
        ? {
            teacherId: activeTurn.teacherId,
            userId: activeTurn.userId,
            teacherCode: activeTurn.teacherCode,
            fullName: activeTurn.fullName,
            seniorityLevel:
              activeTurn.seniorityLevel,
            sessionExpiresAt:
              activeTurn.sessionExpiresAt,
          }
        : null,

      queue: queue.map((item, index) => ({
        rank: index + 1,
        teacherId: item.teacherId,
        userId: item.userId,
        teacherCode: item.teacherCode,
        fullName: item.fullName,
        seniorityLevel: item.seniorityLevel,
        sessionExpiresAt:
          item.sessionExpiresAt,
      })),

      session: {
        expiresAt:
          sessionCheck.session.expires_at,
        remainingMinutes:
          getRemainingMinutes(
            sessionCheck.session.expires_at
          ),
      },

      notifications: {
        unreadCount:
          unreadNotificationCount,
        recent: recentNotifications,
      },

      visibleOfferingPool,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Failed to load faculty dashboard.",
      },
      {
        status: 500,
      }
    );
  }
}
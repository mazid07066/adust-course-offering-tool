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
import {
  getCurrentActiveFacultyTurn,
  getEligibleFacultyTurnQueue,
} from "@/lib/faculty-turn";

const FACULTY_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
];

export async function GET(req: NextRequest) {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        { error: "Faculty account is not linked to a teacher record." },
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

    await processFacultySessionWarningsAndExpiry(sessionToken);
    const sessionCheck = await validateFacultySession(sessionToken);

    if (!sessionCheck.valid || !sessionCheck.session) {
      return NextResponse.json(
        { error: sessionCheck.message || "Faculty session is invalid." },
        { status: 401 }
      );
    }

    const teacher = await prisma.teachers.findUnique({
      where: { id: guard.teacher_id },
      include: {
        departments: true,
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "Faculty record not found." },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

    const windowStatus = await getFacultyChoiceWindowStatus();
    const creditPolicy = await getFacultyLevelCreditPolicy(teacher.seniority_level);
    const activeTurn = await getCurrentActiveFacultyTurn();
    const queue = await getEligibleFacultyTurnQueue();

    const canActNow = activeTurn ? activeTurn.teacherId === teacher.id : false;

    const unreadNotificationCount = await prisma.notifications.count({
      where: {
        is_read: false,
        OR: [
          { recipient_user_id: guard.id },
          { recipient_teacher_id: teacher.id },
        ],
      },
    });

    const recentNotifications = await prisma.notifications.findMany({
      where: {
        OR: [
          { recipient_user_id: guard.id },
          { recipient_teacher_id: teacher.id },
        ],
      },
      orderBy: [{ created_at: "desc" }],
      take: 10,
    });

    let visibleOfferingCount = 0;
    let activeTermName: string | null = null;

    if (termName) {
      const term = await prisma.academic_terms.findFirst({
        where: { name: termName },
        select: { id: true, name: true },
      });

      if (term) {
        activeTermName = term.name;

        visibleOfferingCount = await prisma.offered_courses.count({
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
      }
    } else {
      const latestVisibleOffering = await prisma.offerings.findFirst({
        where: {
          status: {
            in: FACULTY_VISIBLE_OFFERING_STATUSES,
          },
        },
        orderBy: [{ academic_term_id: "desc" }, { id: "desc" }],
        include: {
          academic_terms: true,
        },
      });

      if (latestVisibleOffering) {
        activeTermName = latestVisibleOffering.academic_terms?.name || null;

        visibleOfferingCount = await prisma.offered_courses.count({
          where: {
            primary_offered_course_id: null,
            offering_id: latestVisibleOffering.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        teacherCode: teacher.teacher_code,
        fullName: teacher.full_name,
        designation: teacher.designation,
        departmentCode: teacher.departments?.short_name || null,
        departmentName: teacher.departments?.name || null,
        seniorityLevel: teacher.seniority_level,
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
            seniorityLevel: activeTurn.seniorityLevel,
            sessionExpiresAt: activeTurn.sessionExpiresAt,
          }
        : null,
      queue: queue.map((item, index) => ({
        rank: index + 1,
        teacherId: item.teacherId,
        userId: item.userId,
        teacherCode: item.teacherCode,
        fullName: item.fullName,
        seniorityLevel: item.seniorityLevel,
        sessionExpiresAt: item.sessionExpiresAt,
      })),
      session: {
        expiresAt: sessionCheck.session.expires_at,
        remainingMinutes: getRemainingMinutes(sessionCheck.session.expires_at),
      },
      notifications: {
        unreadCount: unreadNotificationCount,
        recent: recentNotifications,
      },
      visibleOfferingPool: {
        activeTermName,
        visibleOfferingCount,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load faculty dashboard." },
      { status: 500 }
    );
  }
}
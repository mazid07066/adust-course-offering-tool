import { prisma } from "@/lib/prisma";
import { getFacultyChoiceWindowStatus } from "@/lib/system-settings";

export type ActiveFacultyTurn = {
  teacherId: number;
  userId: number;
  teacherCode: string;
  fullName: string;
  seniorityLevel: number | null;
  sessionId: number;
  sessionCreatedAt: Date;
  sessionExpiresAt: Date;
};

function compareFacultyTurns(a: ActiveFacultyTurn, b: ActiveFacultyTurn) {
  const aLevel = a.seniorityLevel ?? 9999;
  const bLevel = b.seniorityLevel ?? 9999;

  if (aLevel !== bLevel) return aLevel - bLevel;

  const aCreated = new Date(a.sessionCreatedAt).getTime();
  const bCreated = new Date(b.sessionCreatedAt).getTime();

  if (aCreated !== bCreated) return aCreated - bCreated;

  return a.teacherId - b.teacherId;
}

export async function getEligibleFacultyTurnQueue(): Promise<ActiveFacultyTurn[]> {
  const windowStatus = await getFacultyChoiceWindowStatus();

  if (windowStatus !== "OPEN") {
    return [];
  }

  const now = new Date();

  const sessions = await prisma.faculty_login_sessions.findMany({
    where: {
      revoked_at: null,
      expires_at: {
        gt: now,
      },
      teacher_id: {
        not: null,
      },
    },
    orderBy: [{ created_at: "asc" }],
  });

  if (sessions.length === 0) {
    return [];
  }

  const userIds = Array.from(new Set(sessions.map((s) => s.user_id)));
  const teacherIds = Array.from(
    new Set(sessions.map((s) => s.teacher_id).filter(Boolean) as number[])
  );

  const [users, teachers] = await Promise.all([
    prisma.users.findMany({
      where: {
        id: { in: userIds },
        is_active: true,
      },
      select: {
        id: true,
        teacher_id: true,
      },
    }),
    prisma.teachers.findMany({
      where: {
        id: { in: teacherIds },
        is_active: true,
      },
      select: {
        id: true,
        teacher_code: true,
        full_name: true,
        seniority_level: true,
      },
    }),
  ]);

  const activeUserIds = new Set(users.map((u) => u.id));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  const queue: ActiveFacultyTurn[] = [];

  for (const session of sessions) {
    if (!activeUserIds.has(session.user_id)) continue;
    if (!session.teacher_id) continue;

    const teacher = teacherMap.get(session.teacher_id);
    if (!teacher) continue;

    queue.push({
      teacherId: teacher.id,
      userId: session.user_id,
      teacherCode: teacher.teacher_code,
      fullName: teacher.full_name,
      seniorityLevel: teacher.seniority_level ?? null,
      sessionId: session.id,
      sessionCreatedAt: session.created_at,
      sessionExpiresAt: session.expires_at,
    });
  }

  queue.sort(compareFacultyTurns);

  return queue;
}

export async function getCurrentActiveFacultyTurn(): Promise<ActiveFacultyTurn | null> {
  const queue = await getEligibleFacultyTurnQueue();
  return queue.length > 0 ? queue[0] : null;
}
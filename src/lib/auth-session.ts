import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean | null;
  teacher_id: number | null;
};

type SessionUserLookupRow = {
  user_id: number;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean | null;
  teacher_id: number | null;
  expires_at: Date;
  revoked_at: Date | null;
};

/**
 * Resolve the currently authenticated UniFlow user.
 *
 * The active authentication flow uses the existing
 * `faculty_login_sessions` table.
 *
 * Previously this function performed two sequential database
 * round trips:
 *
 *   1. faculty_login_sessions lookup
 *   2. users lookup
 *
 * Faculty pages call several authenticated APIs in parallel, so
 * removing one database round trip from every API request reduces
 * repeated remote database latency.
 *
 * This keeps the same table, cookie, session policy, and return
 * shape while resolving the session and user in one parameterized
 * JOIN query.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("sessionToken")?.value;

  if (!sessionToken) {
    return null;
  }

  const rows = await prisma.$queryRaw<SessionUserLookupRow[]>`
    SELECT
      u.id AS user_id,
      u.username,
      u.full_name,
      u.role,
      u.is_active,
      u.teacher_id,
      s.expires_at,
      s.revoked_at
    FROM faculty_login_sessions AS s
    INNER JOIN users AS u
      ON u.id = s.user_id
    WHERE s.session_token = ${sessionToken}
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  if (row.revoked_at) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }

  if (!row.is_active) {
    return null;
  }

  return {
    id: row.user_id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    teacher_id: row.teacher_id ?? null,
  };
}
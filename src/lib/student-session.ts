import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const STUDENT_SESSION_COOKIE = "uniflow_student_session";

export type StudentPortalSession = {
  sessionId: number;
  accountId: number;
  studentDbId: number;
  studentId: string;
  fullName: string;
  email: string | null;
  expiresAt: string;
};

export function createStudentSessionToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashStudentSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function isStudentPortalEnabled() {
  const rows = await prisma.$queryRaw<
    { portal_enabled: boolean; login_message: string | null }[]
  >`
    SELECT portal_enabled, login_message
    FROM student_portal_settings
    WHERE id = 1
    LIMIT 1
  `;

  return {
    enabled: Boolean(rows[0]?.portal_enabled),
    message:
      rows[0]?.login_message ||
      "Student portal is not open yet. Please contact the department office.",
  };
}

export async function getStudentSession(): Promise<StudentPortalSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;

  if (!token) return null;

  const tokenHash = hashStudentSessionToken(token);

  const rows = await prisma.$queryRaw<StudentPortalSession[]>`
    SELECT
      sls.id AS "sessionId",
      spa.id AS "accountId",
      s.id AS "studentDbId",
      s.student_id AS "studentId",
      s.full_name AS "fullName",
      spa.email AS "email",
      sls.expires_at::text AS "expiresAt"
    FROM student_login_sessions sls
    JOIN student_portal_accounts spa ON spa.id = sls.account_id
    JOIN students s ON s.id = spa.student_id
    WHERE sls.session_token_hash = ${tokenHash}
      AND sls.revoked_at IS NULL
      AND sls.expires_at > NOW()
      AND spa.is_active = TRUE
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function requireStudentSession() {
  const portal = await isStudentPortalEnabled();

  if (!portal.enabled) {
    redirect("/student/login?portal=closed");
  }

  const session = await getStudentSession();

  if (!session) {
    redirect("/student/login");
  }

  return session;
}

export async function revokeCurrentStudentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;

  if (!token) return;

  const tokenHash = hashStudentSessionToken(token);

  await prisma.$executeRaw`
    UPDATE student_login_sessions
    SET revoked_at = NOW()
    WHERE session_token_hash = ${tokenHash}
      AND revoked_at IS NULL
  `;
}
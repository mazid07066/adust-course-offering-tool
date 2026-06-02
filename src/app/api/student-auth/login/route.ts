import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStudentPassword } from "@/lib/student-password";
import {
  createStudentSessionToken,
  hashStudentSessionToken,
  STUDENT_SESSION_COOKIE,
  isStudentPortalEnabled,
} from "@/lib/student-session";

type LoginRow = {
  accountId: number;
  studentDbId: number;
  studentId: string;
  fullName: string;
  email: string | null;
  passwordHash: string;
  isActive: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const portal = await isStudentPortalEnabled();

    if (!portal.enabled) {
      return NextResponse.json(
        { error: portal.message },
        { status: 403 }
      );
    }

    const body = await req.json();

    const identifier = String(body.identifier || "").trim();
    const password = String(body.password || "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Student ID/email and password are required." },
        { status: 400 }
      );
    }

    const rows = await prisma.$queryRaw<LoginRow[]>`
      SELECT
        spa.id AS "accountId",
        s.id AS "studentDbId",
        s.student_id AS "studentId",
        s.full_name AS "fullName",
        spa.email AS "email",
        spa.password_hash AS "passwordHash",
        spa.is_active AS "isActive"
      FROM student_portal_accounts spa
      JOIN students s ON s.id = spa.student_id
      WHERE
        s.student_id = ${identifier}
        OR LOWER(COALESCE(spa.email, '')) = LOWER(${identifier})
      LIMIT 1
    `;

    const account = rows[0];

    if (!account || !account.isActive) {
      return NextResponse.json(
        { error: "Invalid student login credentials." },
        { status: 401 }
      );
    }

    const validPassword = verifyStudentPassword(password, account.passwordHash);

    if (!validPassword) {
      return NextResponse.json(
        { error: "Invalid student login credentials." },
        { status: 401 }
      );
    }

    await prisma.$executeRaw`
      UPDATE student_login_sessions
      SET revoked_at = NOW()
      WHERE account_id = ${account.accountId}
        AND revoked_at IS NULL
    `;

    const token = createStudentSessionToken();
    const tokenHash = hashStudentSessionToken(token);

    const userAgent = req.headers.get("user-agent") || null;
    const ipAddress =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      null;

    await prisma.$executeRaw`
      INSERT INTO student_login_sessions (
        account_id,
        session_token_hash,
        user_agent,
        ip_address,
        created_at,
        expires_at
      )
      VALUES (
        ${account.accountId},
        ${tokenHash},
        ${userAgent},
        ${ipAddress},
        NOW(),
        NOW() + INTERVAL '12 hours'
      )
    `;

    await prisma.$executeRaw`
      UPDATE student_portal_accounts
      SET last_login_at = NOW(),
          updated_at = NOW()
      WHERE id = ${account.accountId}
    `;

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      student: {
        studentDbId: account.studentDbId,
        studentId: account.studentId,
        fullName: account.fullName,
        email: account.email,
      },
    });

    response.cookies.set(STUDENT_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Student login failed." },
      { status: 500 }
    );
  }
}
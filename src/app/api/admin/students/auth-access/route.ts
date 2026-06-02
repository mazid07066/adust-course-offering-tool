import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { hashStudentPassword } from "@/lib/student-password";

type StudentAccessRow = {
  studentDbId: number;
  studentId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  accountId: number | null;
  accountEmail: string | null;
  isActive: boolean | null;
  mustChangePassword: boolean | null;
  lastLoginAt: string | null;
};

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();

    const searchText = `%${q}%`;

    const rows = await prisma.$queryRaw<StudentAccessRow[]>`
      SELECT
        s.id AS "studentDbId",
        s.student_id AS "studentId",
        s.full_name AS "fullName",
        s.email AS "email",
        s.phone AS "phone",
        spa.id AS "accountId",
        spa.email AS "accountEmail",
        spa.is_active AS "isActive",
        spa.must_change_password AS "mustChangePassword",
        spa.last_login_at::text AS "lastLoginAt"
      FROM students s
      LEFT JOIN student_portal_accounts spa ON spa.student_id = s.id
      WHERE
        ${q === ""} = TRUE
        OR s.student_id ILIKE ${searchText}
        OR s.full_name ILIKE ${searchText}
        OR COALESCE(s.email, '') ILIKE ${searchText}
        OR COALESCE(s.phone, '') ILIKE ${searchText}
      ORDER BY s.student_id ASC
      LIMIT 100
    `;

    const settingRows = await prisma.$queryRaw<
      { portal_enabled: boolean; login_message: string | null }[]
    >`
      SELECT portal_enabled, login_message
      FROM student_portal_settings
      WHERE id = 1
      LIMIT 1
    `;

    return NextResponse.json({
      success: true,
      portal: {
        enabled: Boolean(settingRows[0]?.portal_enabled),
        loginMessage:
          settingRows[0]?.login_message ||
          "Student portal is not open yet. Please contact the department office.",
      },
      students: rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student portal access list." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    const action = String(body.action || "");
    const studentDbId = Number(body.studentDbId || 0);

    if (action === "UPDATE_PORTAL_SETTING") {
      const portalEnabled = Boolean(body.portalEnabled);
      const loginMessage = String(body.loginMessage || "").trim();

      await prisma.$executeRaw`
        INSERT INTO student_portal_settings (id, portal_enabled, login_message, updated_at)
        VALUES (1, ${portalEnabled}, ${loginMessage || null}, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          portal_enabled = EXCLUDED.portal_enabled,
          login_message = EXCLUDED.login_message,
          updated_at = NOW()
      `;

      return NextResponse.json({
        success: true,
        message: "Student portal setting updated.",
      });
    }

    if (!studentDbId) {
      return NextResponse.json(
        { error: "studentDbId is required." },
        { status: 400 }
      );
    }

    if (action === "CREATE_OR_RESET_ACCOUNT") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "").trim();

      if (!password || password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters." },
          { status: 400 }
        );
      }

      const passwordHash = hashStudentPassword(password);

      await prisma.$executeRaw`
        INSERT INTO student_portal_accounts (
          student_id,
          email,
          password_hash,
          is_active,
          must_change_password,
          created_at,
          updated_at
        )
        VALUES (
          ${studentDbId},
          ${email || null},
          ${passwordHash},
          TRUE,
          TRUE,
          NOW(),
          NOW()
        )
        ON CONFLICT (student_id)
        DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          is_active = TRUE,
          must_change_password = TRUE,
          updated_at = NOW()
      `;

      await prisma.$executeRaw`
        UPDATE student_login_sessions
        SET revoked_at = NOW()
        WHERE account_id IN (
          SELECT id FROM student_portal_accounts WHERE student_id = ${studentDbId}
        )
          AND revoked_at IS NULL
      `;

      return NextResponse.json({
        success: true,
        message: "Student portal account created/reset successfully.",
      });
    }

    if (action === "TOGGLE_ACTIVE") {
      const isActive = Boolean(body.isActive);

      await prisma.$executeRaw`
        UPDATE student_portal_accounts
        SET is_active = ${isActive},
            updated_at = NOW()
        WHERE student_id = ${studentDbId}
      `;

      if (!isActive) {
        await prisma.$executeRaw`
          UPDATE student_login_sessions
          SET revoked_at = NOW()
          WHERE account_id IN (
            SELECT id FROM student_portal_accounts WHERE student_id = ${studentDbId}
          )
            AND revoked_at IS NULL
        `;
      }

      return NextResponse.json({
        success: true,
        message: isActive
          ? "Student portal account activated."
          : "Student portal account deactivated and sessions revoked.",
      });
    }

    return NextResponse.json(
      { error: "Unknown action." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error(error);

    if (String(error?.message || "").includes("student_portal_accounts_email_key")) {
      return NextResponse.json(
        { error: "This email is already linked to another student portal account." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update student portal access." },
      { status: 500 }
    );
  }
}
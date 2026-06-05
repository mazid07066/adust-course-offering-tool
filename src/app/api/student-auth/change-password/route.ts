import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/student-session";
import {
  hashStudentPassword,
  verifyStudentPassword,
  validateStudentPasswordStrength,
} from "@/lib/student-password";

export async function POST(request: NextRequest) {
  try {
    const session = await getStudentSession();

    if (!session?.accountId || !session?.studentId) {
      return NextResponse.json(
        { error: "Unauthorized student session." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        {
          error:
            "Current password, new password, and confirm password are required.",
        },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirm password do not match." },
        { status: 400 }
      );
    }

    const strength = validateStudentPasswordStrength(newPassword);

    if (!strength.valid) {
      return NextResponse.json({ error: strength.message }, { status: 400 });
    }

    const accountRows = await prisma.$queryRaw<any[]>`
      SELECT id, password_hash, is_active
      FROM student_portal_accounts
      WHERE id = ${session.accountId}
      LIMIT 1;
    `;

    const account = accountRows[0];

    if (!account || !account.is_active) {
      return NextResponse.json(
        { error: "Student account is not active." },
        { status: 403 }
      );
    }

    const passwordOk = await verifyStudentPassword(
      currentPassword,
      account.password_hash
    );

    if (!passwordOk) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 }
      );
    }

    const newHash = await hashStudentPassword(newPassword);

    await prisma.$executeRaw`
      UPDATE student_portal_accounts
      SET
        password_hash = ${newHash},
        must_change_password = false,
        updated_at = NOW()
      WHERE id = ${session.accountId};
    `;

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Student change password error:", error);
    return NextResponse.json(
      { error: "Failed to change password." },
      { status: 500 }
    );
  }
}
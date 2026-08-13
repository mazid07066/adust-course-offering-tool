import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  cookies,
} from "next/headers";

import bcrypt from "bcryptjs";

import {
  prisma,
} from "@/lib/prisma";

import {
  validateFacultySession,
  revokeExistingFacultySessions,
} from "@/lib/faculty-session";

import {
  validateUniFlowPassword,
} from "@/lib/password-policy";

export async function POST(
  req: NextRequest
) {
  try {
    const cookieStore =
      await cookies();

    const sessionToken =
      cookieStore.get(
        "sessionToken"
      )?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your UniFlow session is not active. Please sign in again.",
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
          success: false,
          error:
            "Your UniFlow session has expired or is no longer active. Please sign in again.",
        },
        {
          status: 401,
        }
      );
    }

    const userId =
      sessionCheck.session.user_id;

    const body =
      await req.json();

    const currentPassword =
      String(
        body.currentPassword || ""
      );

    const newPassword =
      String(
        body.newPassword || ""
      );

    const confirmPassword =
      String(
        body.confirmPassword || ""
      );

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Current password, new password, and confirmation password are required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "New password and confirmation password do not match.",
        },
        {
          status: 400,
        }
      );
    }

    const passwordCheck =
      validateUniFlowPassword(
        newPassword
      );

    if (!passwordCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error:
            passwordCheck.errors[0] ||
            "Password does not meet UniFlow security requirements.",

          passwordErrors:
            passwordCheck.errors,
        },
        {
          status: 400,
        }
      );
    }

    const user =
      await prisma.users.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          id:
            true,

          username:
            true,

          full_name:
            true,

          password_hash:
            true,

          role:
            true,

          is_active:
            true,

          teacher_id:
            true,

          teachers: {
            select: {
              id:
                true,

              is_active:
                true,

              email:
                true,
            },
          },
        },
      });

    if (
      !user ||
      user.role !== "FACULTY" ||
      !user.is_active ||
      !user.teacher_id ||
      !user.teachers ||
      !user.teachers.is_active
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This account is not available for faculty password management.",
        },
        {
          status: 403,
        }
      );
    }

    const currentPasswordCorrect =
      await bcrypt.compare(
        currentPassword,
        user.password_hash
      );

    if (!currentPasswordCorrect) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Current password is incorrect.",
        },
        {
          status: 400,
        }
      );
    }

    const sameAsCurrent =
      await bcrypt.compare(
        newPassword,
        user.password_hash
      );

    if (sameAsCurrent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your new password must be different from your current password.",
        },
        {
          status: 400,
        }
      );
    }

    const newPasswordHash =
      await bcrypt.hash(
        newPassword,
        12
      );

    const now =
      new Date();

    await prisma.$transaction(
      async (tx) => {
        await tx.users.update({
          where: {
            id:
              user.id,
          },

          data: {
            password_hash:
              newPasswordHash,
          },
        });

        /*
         * Any unused forgotten-password links for this account
         * become invalid after a logged-in password change.
         */
        await tx.faculty_password_reset_tokens.updateMany({
          where: {
            user_id:
              user.id,

            used_at:
              null,
          },

          data: {
            used_at:
              now,
          },
        });
      }
    );

    /*
     * Changing the password is a security event.
     * Revoke all current faculty sessions.
     */
    await revokeExistingFacultySessions(
      user.id
    );

    const response =
      NextResponse.json({
        success: true,
        message:
          "Your UniFlow password has been changed successfully. Please sign in again using the same username and your new password.",
      });

    /*
     * Also remove the browser session cookie immediately.
     */
    response.cookies.set(
      "sessionToken",
      "",
      {
        httpOnly: true,
        path: "/",
        expires:
          new Date(0),
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Faculty change-password request failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to change your password at this time. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}

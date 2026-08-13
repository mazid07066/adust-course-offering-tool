import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
} from "crypto";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

import {
  revokeExistingFacultySessions,
} from "@/lib/faculty-session";

import {
  validateUniFlowPassword,
} from "@/lib/password-policy";

function hashResetToken(
  rawToken: string
) {
  return createHash("sha256")
    .update(rawToken)
    .digest("hex");
}

export async function POST(
  req: NextRequest
) {
  try {
    const body =
      await req.json();

    const token =
      String(
        body.token || ""
      ).trim();

    const newPassword =
      String(
        body.newPassword || ""
      );

    const confirmPassword =
      String(
        body.confirmPassword || ""
      );

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Password-reset token is missing.",
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

    if (
      !passwordCheck.valid
    ) {
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

    const tokenHash =
      hashResetToken(
        token
      );

    const now =
      new Date();

    const resetToken =
      await prisma.faculty_password_reset_tokens.findUnique({
        where: {
          token_hash:
            tokenHash,
        },

        select: {
          id:
            true,

          user_id:
            true,

          expires_at:
            true,

          used_at:
            true,
        },
      });

    if (!resetToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This password-reset link is invalid. Please request a new password-reset email.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      resetToken.used_at
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This password-reset link has already been used. Please request a new password-reset email.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      new Date(
        resetToken.expires_at
      ).getTime() <=
      now.getTime()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This password-reset link has expired. Please request a new password-reset email.",
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
            resetToken.user_id,
        },

        select: {
          id:
            true,

          role:
            true,

          is_active:
            true,

          password_hash:
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
            "This faculty account is not available for password reset. Please contact the department administrator.",
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

    /*
     * Consume the token and change the password in one database
     * transaction.
     *
     * The updateMany condition prevents the same token from
     * being consumed twice if two requests arrive together.
     */
    await prisma.$transaction(
      async (tx) => {
        const consumeResult =
          await tx.faculty_password_reset_tokens.updateMany({
            where: {
              id:
                resetToken.id,

              used_at:
                null,

              expires_at: {
                gt:
                  now,
              },
            },

            data: {
              used_at:
                now,
            },
          });

        if (
          consumeResult.count !== 1
        ) {
          throw new Error(
            "RESET_TOKEN_ALREADY_CONSUMED"
          );
        }

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
         * Invalidate every other still-live reset token belonging
         * to this faculty user.
         */
        await tx.faculty_password_reset_tokens.updateMany({
          where: {
            user_id:
              user.id,

            id: {
              not:
                resetToken.id,
            },

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
     * A password reset is a security event.
     *
     * Revoke existing UniFlow login sessions so a previously
     * authenticated browser cannot continue using the account.
     */
    await revokeExistingFacultySessions(
      user.id
    );

    return NextResponse.json({
      success:
        true,

      message:
        "Your UniFlow password has been reset successfully. Please sign in again using your new password.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "RESET_TOKEN_ALREADY_CONSUMED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This password-reset link is no longer valid. Please request a new password-reset email.",
        },
        {
          status: 400,
        }
      );
    }

    console.error(
      "Reset-password request failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to reset the password at this time. Please request a new password-reset email or contact the department administrator.",
      },
      {
        status: 500,
      }
    );
  }
}

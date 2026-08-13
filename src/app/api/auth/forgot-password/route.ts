import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  randomBytes,
} from "crypto";

import { prisma } from "@/lib/prisma";

import {
  sendFacultyPasswordResetEmail,
} from "@/lib/uniflow-mail";

const RESET_TOKEN_VALID_MINUTES = 15;
const RESET_RATE_LIMIT_MINUTES = 30;
const RESET_RATE_LIMIT_COUNT = 3;

const GENERIC_RESPONSE = {
  success: true,
  message:
    "If this email is linked to an active faculty account, a password-reset email has been sent.",
};

function normalizeEmail(
  value: unknown
) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function looksLikeEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

function hashResetToken(
  rawToken: string
) {
  return createHash("sha256")
    .update(rawToken)
    .digest("hex");
}

function minutesFromNow(
  minutes: number
) {
  return new Date(
    Date.now() +
      minutes * 60 * 1000
  );
}

function minutesAgo(
  minutes: number
) {
  return new Date(
    Date.now() -
      minutes * 60 * 1000
  );
}

export async function POST(
  req: NextRequest
) {
  /*
   * SECURITY REQUIREMENT
   *
   * This endpoint intentionally returns the same public response
   * whether the supplied email exists or not.
   *
   * That prevents account/email enumeration.
   */
  try {
    let body: {
      email?: unknown;
    };

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        GENERIC_RESPONSE
      );
    }

    const email =
      normalizeEmail(
        body.email
      );

    if (
      !email ||
      !looksLikeEmail(email)
    ) {
      return NextResponse.json(
        GENERIC_RESPONSE
      );
    }

    /*
     * Faculty identity is authoritative through:
     *
     * teachers.email
     *      ↓
     * users.teacher_id
     *
     * Only an active FACULTY user linked to an active teacher
     * can receive a self-service password-reset email.
     */
    const user =
      await prisma.users.findFirst({
        where: {
          role:
            "FACULTY",

          is_active:
            true,

          teacher_id: {
            not:
              null,
          },

          teachers: {
            is: {
              is_active:
                true,

              email: {
                equals:
                  email,

                mode:
                  "insensitive",
              },
            },
          },
        },

        select: {
          id:
            true,

          full_name:
            true,

          username:
            true,

          teacher_id:
            true,

          teachers: {
            select: {
              full_name:
                true,

              email:
                true,
            },
          },
        },
      });

    /*
     * Do not reveal whether the email exists.
     */
    if (
      !user ||
      !user.teacher_id ||
      !user.teachers?.email
    ) {
      return NextResponse.json(
        GENERIC_RESPONSE
      );
    }

    /*
     * Basic database-backed rate limiting:
     *
     * Maximum three reset requests for this faculty account
     * within thirty minutes.
     *
     * The public response remains identical when rate-limited.
     */
    const recentRequestCount =
      await prisma.faculty_password_reset_tokens.count({
        where: {
          user_id:
            user.id,

          created_at: {
            gte:
              minutesAgo(
                RESET_RATE_LIMIT_MINUTES
              ),
          },
        },
      });

    if (
      recentRequestCount >=
      RESET_RATE_LIMIT_COUNT
    ) {
      console.warn(
        `Faculty password reset rate limit reached for user ${user.id}.`
      );

      return NextResponse.json(
        GENERIC_RESPONSE
      );
    }

    /*
     * Remove old expired reset-token rows.
     *
     * This cleanup is not required for security, but prevents
     * unnecessary accumulation of expired tokens.
     */
    await prisma.faculty_password_reset_tokens.deleteMany({
      where: {
        expires_at: {
          lt:
            new Date(),
        },
      },
    });

    /*
     * A new reset request invalidates all previous unused reset
     * links for this faculty user.
     */
    await prisma.faculty_password_reset_tokens.updateMany({
      where: {
        user_id:
          user.id,

        used_at:
          null,

        expires_at: {
          gt:
            new Date(),
        },
      },

      data: {
        used_at:
          new Date(),
      },
    });

    /*
     * Generate 32 cryptographically secure random bytes.
     *
     * Raw token:
     *   emailed to faculty
     *
     * SHA-256 hash:
     *   stored in database
     *
     * The raw token is never stored.
     */
    const rawToken =
      randomBytes(32)
        .toString("hex");

    const tokenHash =
      hashResetToken(
        rawToken
      );

    const expiresAt =
      minutesFromNow(
        RESET_TOKEN_VALID_MINUTES
      );

    const resetRow =
      await prisma.faculty_password_reset_tokens.create({
        data: {
          user_id:
            user.id,

          token_hash:
            tokenHash,

          expires_at:
            expiresAt,

          used_at:
            null,
        },

        select: {
          id:
            true,
        },
      });

    try {
      await sendFacultyPasswordResetEmail({
        recipientEmail:
          user.teachers.email,

        facultyName:
          user.teachers.full_name ||
          user.full_name,

        resetToken:
          rawToken,
      });
    } catch (mailError) {
      /*
       * If delivery fails, immediately invalidate this token.
       * The public response is still generic so that account
       * existence cannot be inferred.
       */
      await prisma.faculty_password_reset_tokens.update({
        where: {
          id:
            resetRow.id,
        },

        data: {
          used_at:
            new Date(),
        },
      });

      console.error(
        "Faculty password-reset email delivery failed:",
        mailError
      );

      return NextResponse.json(
        GENERIC_RESPONSE
      );
    }

    console.info(
      `Faculty password-reset email accepted for user ${user.id}.`
    );

    return NextResponse.json(
      GENERIC_RESPONSE
    );
  } catch (error) {
    /*
     * Do not expose database, SMTP, user, or token details to
     * the public caller.
     */
    console.error(
      "Forgot-password request failed:",
      error
    );

    return NextResponse.json(
      GENERIC_RESPONSE
    );
  }
}

import { NextResponse } from "next/server";

import {
  getStudentSession,
  isStudentPortalEnabled,
} from "@/lib/student-session";

import {
  getStudentRegistrationContext,
} from "@/lib/student-registration-context";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    /*
     * ----------------------------------------------------------
     * 1. Student portal availability.
     * ----------------------------------------------------------
     */
    const portal =
      await isStudentPortalEnabled();

    if (!portal.enabled) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          portalEnabled: false,
          message: portal.message,
          registrationContext: null,
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * 2. Authenticated student identity.
     *
     * IMPORTANT:
     * The API does NOT accept studentId or studentDbId from
     * query parameters or request body.
     *
     * Student identity comes only from the validated portal
     * session.
     * ----------------------------------------------------------
     */
    const session =
      await getStudentSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          portalEnabled: true,
          message:
            "Student authentication is required.",
          registrationContext: null,
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ----------------------------------------------------------
     * 3. Resolve read-only registration context.
     * ----------------------------------------------------------
     */
    const registrationContext =
      await getStudentRegistrationContext(
        session.studentDbId
      );

    return NextResponse.json({
      success: true,
      authenticated: true,
      portalEnabled: true,

      student: {
        accountId:
          session.accountId,

        studentDbId:
          session.studentDbId,

        studentId:
          session.studentId,

        fullName:
          session.fullName,

        email:
          session.email,
      },

      registrationContext,
    });
  } catch (error) {
    console.error(
      "Failed to load student registration context:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        portalEnabled: true,
        message:
          "Failed to load student registration context.",
        registrationContext: null,
      },
      {
        status: 500,
      }
    );
  }
}
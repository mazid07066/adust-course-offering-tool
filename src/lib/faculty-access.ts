import { getFacultyChoiceWindowStatus } from "./system-settings";
import { validateFacultySession } from "./faculty-session";

export async function checkFacultyAccess(sessionToken: string) {
  const sessionCheck = await validateFacultySession(sessionToken);

  if (!sessionCheck.valid) {
    return {
      allowed: false,
      message: sessionCheck.message,
    };
  }

  const windowStatus = await getFacultyChoiceWindowStatus();

  if (windowStatus === "CLOSED") {
    return {
      allowed: false,
      message: "Faculty choice window is closed.",
    };
  }

  if (windowStatus === "FINAL_LOCKED") {
    return {
      allowed: false,
      message: "Faculty choice is locked.",
    };
  }

  return {
    allowed: true,
    session: sessionCheck.session,
  };
}

export async function canFacultyEdit(sessionToken: string) {
  const access = await checkFacultyAccess(sessionToken);

  if (!access.allowed) return access;

  const windowStatus = await getFacultyChoiceWindowStatus();

  if (windowStatus !== "OPEN") {
    return {
      allowed: false,
      message: "Editing not allowed at this stage.",
    };
  }

  return {
    allowed: true,
    session: access.session,
  };
}
import { validateFacultySession, processFacultySessionWarningsAndExpiry } from "@/lib/faculty-session";
import {
  getActiveFacultySeniorityLevel,
  getActiveFacultyTeacherId,
  getFacultyChoiceWindowStatus,
} from "@/lib/system-settings";

const FACULTY_VISIBLE_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
];

export function canFacultyViewOfferingStatus(status: string) {
  return FACULTY_VISIBLE_STATUSES.includes(String(status || "").trim().toUpperCase());
}

export async function canFacultyEdit(sessionToken: string, teacher?: {
  id: number;
  seniority_level: number | null;
}) {
  const windowStatus = await getFacultyChoiceWindowStatus();

  if (windowStatus !== "OPEN") {
    return {
      allowed: false,
      message: "Faculty choice window is not open right now.",
    };
  }

  const validation = await validateFacultySession(sessionToken);

  if (!validation.valid || !validation.session) {
    return {
      allowed: false,
      message: validation.message || "Faculty session is invalid.",
    };
  }

  await processFacultySessionWarningsAndExpiry(sessionToken);

  const revalidation = await validateFacultySession(sessionToken);

  if (!revalidation.valid || !revalidation.session) {
    return {
      allowed: false,
      message: revalidation.message || "Faculty session expired.",
    };
  }

  if (!teacher) {
    return {
      allowed: false,
      message: "Faculty record is missing.",
    };
  }

  const activeLevel = await getActiveFacultySeniorityLevel();
  const activeTeacherId = await getActiveFacultyTeacherId();

  if (activeLevel && teacher.seniority_level !== activeLevel) {
    return {
      allowed: false,
      message: `Only Level ${activeLevel} is active for faculty choice right now.`,
    };
  }

  if (activeTeacherId && teacher.id !== activeTeacherId) {
    return {
      allowed: false,
      message: "Another faculty member is currently active for editing.",
    };
  }

  return {
    allowed: true,
    message: "",
  };
}
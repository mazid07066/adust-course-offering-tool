export const FACULTY_LOAD_WARNING_CREDITS = 12;
export const FACULTY_LOAD_OVERLOAD_CREDITS = 15;

export function getFacultyLoadLevel(totalAssignedCredits: number) {
  if (totalAssignedCredits >= FACULTY_LOAD_OVERLOAD_CREDITS) {
    return "OVERLOAD";
  }

  if (totalAssignedCredits >= FACULTY_LOAD_WARNING_CREDITS) {
    return "WARNING";
  }

  return "NORMAL";
}

export function getFacultyLoadMessage(totalAssignedCredits: number) {
  const level = getFacultyLoadLevel(totalAssignedCredits);

  if (level === "OVERLOAD") {
    return `Assigned credits ${totalAssignedCredits} reached overload threshold (${FACULTY_LOAD_OVERLOAD_CREDITS}).`;
  }

  if (level === "WARNING") {
    return `Assigned credits ${totalAssignedCredits} reached warning threshold (${FACULTY_LOAD_WARNING_CREDITS}).`;
  }

  return `Assigned credits ${totalAssignedCredits} are within normal range.`;
}
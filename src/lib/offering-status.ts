export const OFFERING_STATUS = {
  DRAFT: "DRAFT",
  BUFFER_READY: "BUFFER_READY",
  FACULTY_CHOICE_BUFFER: "FACULTY_CHOICE_BUFFER",
  FACULTY_CHOICE_FINALIZED: "FACULTY_CHOICE_FINALIZED",
  CONFIRMED: "CONFIRMED",
} as const;

export type OfferingStatus =
  (typeof OFFERING_STATUS)[keyof typeof OFFERING_STATUS];

export function canEditStructure(status: string) {
  const clean = String(status || "").trim().toUpperCase();

  return (
    clean === OFFERING_STATUS.DRAFT ||
    clean === OFFERING_STATUS.BUFFER_READY
  );
}

export function canDeleteOffering(status: string) {
  const clean = String(status || "").trim().toUpperCase();
  return clean === OFFERING_STATUS.DRAFT;
}

/**
 * Backward-compatible alias.
 * Some older routes still import canDelete.
 */
export function canDelete(status: string) {
  return canDeleteOffering(status);
}

export function canModifySlots(status: string) {
  const clean = String(status || "").trim().toUpperCase();

  return (
    clean === OFFERING_STATUS.DRAFT ||
    clean === OFFERING_STATUS.BUFFER_READY
  );
}

export function isFacultyChoiceStage(status: string) {
  const clean = String(status || "").trim().toUpperCase();

  return (
    clean === OFFERING_STATUS.FACULTY_CHOICE_BUFFER ||
    clean === OFFERING_STATUS.FACULTY_CHOICE_FINALIZED
  );
}

export function isFullyLocked(status: string) {
  const clean = String(status || "").trim().toUpperCase();
  return clean === OFFERING_STATUS.CONFIRMED;
}

export function canTransitionOfferingStatus(
  currentStatus: string,
  targetStatus: string
) {
  const current = String(currentStatus || "").trim().toUpperCase();
  const target = String(targetStatus || "").trim().toUpperCase();

  const allowed: Record<string, string[]> = {
    [OFFERING_STATUS.DRAFT]: [OFFERING_STATUS.BUFFER_READY],
    [OFFERING_STATUS.BUFFER_READY]: [
      OFFERING_STATUS.DRAFT,
      OFFERING_STATUS.FACULTY_CHOICE_BUFFER,
      OFFERING_STATUS.CONFIRMED,
    ],
    [OFFERING_STATUS.FACULTY_CHOICE_BUFFER]: [
      OFFERING_STATUS.BUFFER_READY,
      OFFERING_STATUS.FACULTY_CHOICE_FINALIZED,
    ],
    [OFFERING_STATUS.FACULTY_CHOICE_FINALIZED]: [
      OFFERING_STATUS.FACULTY_CHOICE_BUFFER,
      OFFERING_STATUS.CONFIRMED,
    ],
    [OFFERING_STATUS.CONFIRMED]: [],
  };

  return allowed[current]?.includes(target) ?? false;
}
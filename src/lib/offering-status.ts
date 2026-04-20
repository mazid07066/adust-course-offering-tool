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
  return status === OFFERING_STATUS.DRAFT || status === OFFERING_STATUS.BUFFER_READY;
}

export function canDelete(status: string) {
  return status === OFFERING_STATUS.DRAFT;
}

export function canModifySlots(status: string) {
  return status === OFFERING_STATUS.DRAFT || status === OFFERING_STATUS.BUFFER_READY;
}

export function isFacultyStage(status: string) {
  return (
    status === OFFERING_STATUS.FACULTY_CHOICE_BUFFER ||
    status === OFFERING_STATUS.FACULTY_CHOICE_FINALIZED
  );
}
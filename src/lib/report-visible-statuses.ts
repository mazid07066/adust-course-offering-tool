export const REPORT_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export function normalizeReportParam(value: string | null) {
  return String(value || "").trim().toUpperCase();
}
export const REPORT_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
] as const;

export const FINAL_REPORT_READY_OFFERING_STATUSES = [
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
] as const;

export type ReportVisibleOfferingStatus =
  (typeof REPORT_VISIBLE_OFFERING_STATUSES)[number];

export function normalizeReportParam(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

export function normalizeReportText(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}
export const REPORT_VISIBLE_OFFERING_STATUSES: string[] = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export const FINAL_REPORT_OFFERING_STATUSES: string[] = [
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export function normalizeReportParam(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

export function isReportVisibleOfferingStatus(status: string | null | undefined) {
  return REPORT_VISIBLE_OFFERING_STATUSES.includes(normalizeReportParam(status));
}

export function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
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

export const DAY_ORDER: Record<string, number> = {
  SATURDAY: 1,
  SUNDAY: 2,
  MONDAY: 3,
  TUESDAY: 4,
  WEDNESDAY: 5,
  THURSDAY: 6,
  FRIDAY: 7,
  "-": 99,
};

export function compareDayTime(
  a: { dayOfWeek: string; startTime: string; courseCode?: string; roomCode?: string },
  b: { dayOfWeek: string; startTime: string; courseCode?: string; roomCode?: string }
) {
  const dayA = DAY_ORDER[normalizeReportParam(a.dayOfWeek)] ?? 98;
  const dayB = DAY_ORDER[normalizeReportParam(b.dayOfWeek)] ?? 98;

  if (dayA !== dayB) return dayA - dayB;
  if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);

  const roomCompare = String(a.roomCode || "").localeCompare(String(b.roomCode || ""));
  if (roomCompare !== 0) return roomCompare;

  return String(a.courseCode || "").localeCompare(String(b.courseCode || ""));
}

export function isLabLikeText(value: string | null | undefined) {
  const text = normalizeReportParam(value);

  return (
    text.includes("LAB") ||
    text.includes("SESSIONAL") ||
    text.includes("PRACTICAL") ||
    text.includes("WORKSHOP")
  );
}

export function isProjectLikeCourse(course: {
  courseCode?: string | null;
  courseTitle?: string | null;
  courseType?: string | null;
}) {
  const code = normalizeReportParam(course.courseCode).replace(/\s+/g, "");
  const title = normalizeReportParam(course.courseTitle);
  const type = normalizeReportParam(course.courseType);

  return (
    ["EEE4139", "EEE4239", "EEE4339"].includes(code) ||
    title.includes("PROJECT") ||
    title.includes("FYDP") ||
    title.includes("THESIS") ||
    title.includes("INTERNSHIP") ||
    title.includes("VIVA") ||
    type.includes("PROJECT") ||
    type.includes("THESIS") ||
    type.includes("INTERNSHIP") ||
    type.includes("VIVA")
  );
}
export const SLOT_OPTIONAL_COURSE_CODES = ["EEE4139", "EEE4239", "EEE4339"];

export const SCHEDULE_CONFLICT_STATUSES = [
  "DRAFT",
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export const REPORT_VISIBLE_OFFERING_STATUSES = [
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export const FINALIZED_REPORT_STATUSES = [
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

export function normalizeCourseCode(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim().toUpperCase();
}

export function normalizePolicyText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

export function isSlotOptionalCourse(course: {
  course_code?: string | null;
  course_title?: string | null;
  course_type?: string | null;
}) {
  const code = normalizeCourseCode(course.course_code);
  const title = normalizePolicyText(course.course_title);
  const type = normalizePolicyText(course.course_type);

  if (SLOT_OPTIONAL_COURSE_CODES.includes(code)) return true;

  return (
    type.includes("PROJECT") ||
    type.includes("INTERNSHIP") ||
    type.includes("THESIS") ||
    type.includes("VIVA") ||
    title.includes("FINAL YEAR DESIGN PROJECT") ||
    title.includes("FYDP") ||
    title.includes("PROJECT") ||
    title.includes("INTERNSHIP") ||
    title.includes("THESIS") ||
    title.includes("VIVA")
  );
}

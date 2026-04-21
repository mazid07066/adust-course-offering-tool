export type ManualCoofferView = {
  id: number;
  target_program_code: string | null;
  manual_course_code: string;
  note: string | null;
};

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function formatManualCoofferLabel(item: ManualCoofferView) {
  const code = item.manual_course_code || "-";
  const target = item.target_program_code ? ` [${item.target_program_code}]` : "";
  const note = item.note ? ` — ${item.note}` : "";
  return `${code}${target}${note}`;
}
export type AcademicTermType =
  | "SPRING"
  | "SUMMER"
  | "FALL";

export type ParsedAcademicTermName = {
  name: string;
  termType: AcademicTermType;
  year: number;
};

const TERM_BATCH_DIGIT: Record<
  AcademicTermType,
  string
> = {
  SPRING: "1",
  SUMMER: "2",
  FALL: "3",
};

export function parseAcademicTermName(
  termName: string
): ParsedAcademicTermName {
  const normalized = String(termName || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  const match = normalized.match(
    /^(SPRING|SUMMER|FALL)\s+(\d{4})$/
  );

  if (!match) {
    throw new Error(
      `Invalid academic term format: ${termName}. Expected SPRING YYYY, SUMMER YYYY, or FALL YYYY.`
    );
  }

  const termType =
    match[1] as AcademicTermType;

  const year =
    Number(match[2]);

  return {
    name: normalized,
    termType,
    year,
  };
}

export function deriveBatchCodeFromAcademicTerm(
  termName: string
): string {
  const parsed =
    parseAcademicTermName(termName);

  const shortYear =
    String(
      parsed.year % 100
    ).padStart(2, "0");

  return (
    shortYear +
    TERM_BATCH_DIGIT[
      parsed.termType
    ]
  );
}

export function buildStudentIdPattern(
  batchCode: string,
  suffix: string | null | undefined
): string {
  const normalizedBatch =
    String(batchCode || "").trim();

  const normalizedSuffix =
    String(suffix || "").trim();

  return normalizedSuffix
    ? `${normalizedBatch}-XXXX-${normalizedSuffix}`
    : `${normalizedBatch}-XXXX-YYY`;
}
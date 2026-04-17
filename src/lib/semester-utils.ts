export type SemesterName = "SPRING" | "SUMMER" | "FALL";

export function normalizeSemesterName(value: string): SemesterName {
  const v = value.trim().toUpperCase();

  if (v === "SPRING" || v === "SUMMER" || v === "FALL") {
    return v;
  }

  throw new Error(`Invalid semester name: ${value}`);
}

export function parseAcademicTerm(term: string) {
  const match = term.trim().toUpperCase().match(/^(SPRING|SUMMER|FALL)\s+(\d{4})$/);

  if (!match) {
    throw new Error(`Invalid academic term format: ${term}`);
  }

  return {
    season: match[1] as SemesterName,
    year: Number(match[2]),
  };
}

export function formatAcademicTerm(season: SemesterName, year: number) {
  return `${season} ${year}`;
}

export function getNextSemester(term: string) {
  const { season, year } = parseAcademicTerm(term);

  if (season === "SPRING") {
    return formatAcademicTerm("SUMMER", year);
  }

  if (season === "SUMMER") {
    return formatAcademicTerm("FALL", year);
  }

  return formatAcademicTerm("SPRING", year + 1);
}

export function compareAcademicTerms(a: string, b: string) {
  const pa = parseAcademicTerm(a);
  const pb = parseAcademicTerm(b);

  const order = {
    SPRING: 1,
    SUMMER: 2,
    FALL: 3,
  };

  const va = pa.year * 10 + order[pa.season];
  const vb = pb.year * 10 + order[pb.season];

  return va - vb;
}

export function getLatestTerm(terms: Array<string | null | undefined>) {
  const valid = terms.filter((t): t is string => Boolean(t));

  if (valid.length === 0) return null;

  return valid.sort(compareAcademicTerms).at(-1) ?? null;
}
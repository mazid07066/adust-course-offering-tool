import { prisma } from "@/lib/prisma";

const academicTermSelect = {
  id: true,
  name: true,
  year: true,
  term_type: true,
  is_active: true,
  is_current: true,
} as const;

export type AcademicTermContext = {
  id: number;
  name: string;
  year: number;
  term_type: string;
  is_active: boolean | null;
  is_current: boolean;
};

export type AcademicTermContextErrorCode =
  | "ACADEMIC_TERM_NOT_FOUND"
  | "CURRENT_ACADEMIC_TERM_NOT_CONFIGURED"
  | "MULTIPLE_CURRENT_ACADEMIC_TERMS";

export class AcademicTermContextError extends Error {
  readonly code: AcademicTermContextErrorCode;

  constructor(
    code: AcademicTermContextErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AcademicTermContextError";
    this.code = code;
  }
}

export type ResolveAcademicTermContextOptions = {
  termName?: string | null;
};

/**
 * Resolves the academic term used by an application request.
 *
 * Resolution order:
 * 1. A non-empty explicitly supplied term name.
 * 2. The single academic term marked is_current = true.
 *
 * This function never silently falls back from an invalid explicit term name
 * to the current term. An invalid explicit selection is treated as an error.
 */
export async function resolveAcademicTermContext(
  options: ResolveAcademicTermContextOptions = {}
): Promise<AcademicTermContext> {
  const requestedTermName = options.termName?.trim();

  if (requestedTermName) {
    const requestedTerm = await prisma.academic_terms.findUnique({
      where: {
        name: requestedTermName,
      },
      select: academicTermSelect,
    });

    if (!requestedTerm) {
      throw new AcademicTermContextError(
        "ACADEMIC_TERM_NOT_FOUND",
        `Academic term "${requestedTermName}" was not found.`
      );
    }

    return requestedTerm;
  }

  return getCurrentAcademicTermContext();
}

/**
 * Returns the single academic term marked as current.
 *
 * take: 2 is intentional. It allows the application to detect an invalid
 * multiple-current-term state instead of silently choosing one record.
 */
export async function getCurrentAcademicTermContext(): Promise<AcademicTermContext> {
  const currentTerms = await prisma.academic_terms.findMany({
    where: {
      is_current: true,
    },
    select: academicTermSelect,
    orderBy: {
      id: "desc",
    },
    take: 2,
  });

  if (currentTerms.length === 0) {
    throw new AcademicTermContextError(
      "CURRENT_ACADEMIC_TERM_NOT_CONFIGURED",
      "No current academic term has been configured."
    );
  }

  if (currentTerms.length > 1) {
    throw new AcademicTermContextError(
      "MULTIPLE_CURRENT_ACADEMIC_TERMS",
      "Multiple academic terms are marked as current."
    );
  }

  return currentTerms[0];
}

export function isAcademicTermContextError(
  error: unknown
): error is AcademicTermContextError {
  return error instanceof AcademicTermContextError;
}

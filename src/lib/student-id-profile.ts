export type StudentProgramInference = {
  inferredDepartmentCode: string | null;
  inferredProgramCode: string | null;
  inferredVariant: string | null;
  reason: string;
};

type ExactOverride = {
  studentId: string;
  departmentCode: string;
  programCode: string;
  variant: string | null;
  reason: string;
};

type SuffixRule = {
  suffix: string;
  departmentCode: string;
  programCode: string;
  variant: string | null;
  reason: string;
};

const EXACT_OVERRIDES: ExactOverride[] = [
  {
    studentId: "21-265-203",
    departmentCode: "RAE",
    programCode: "BSC-RAE-REG-OLD",
    variant: "REG",
    reason: "Exact override for migrated student.",
  },
];

const SUFFIX_RULES: SuffixRule[] = [
  {
    suffix: "206",
    departmentCode: "EEE",
    programCode: "BSC-EEE-REG-NEW",
    variant: "REG",
    reason: "Suffix 206 indicates EEE Regular New curriculum.",
  },
  {
    suffix: "211",
    departmentCode: "EEE",
    programCode: "BSC-EEE-EVE-NEW",
    variant: "EVE",
    reason: "Suffix 211 indicates EEE Evening New curriculum.",
  },
  {
    suffix: "218",
    departmentCode: "RAE",
    programCode: "BSC-RAE-REG-OLD",
    variant: "REG",
    reason: "Suffix 218 indicates RAE Regular Old curriculum.",
  },
  {
    suffix: "228",
    departmentCode: "RAE",
    programCode: "BSC-RAE-REG-OLD",
    variant: "REG",
    reason: "Suffix 228 indicates RAE Regular Old curriculum.",
  },
];

export function normalizeStudentId(raw: string | null | undefined) {
  return String(raw || "").trim();
}

export function getStudentIdSuffix(studentId: string | null | undefined) {
  const normalized = normalizeStudentId(studentId);
  const match = normalized.match(/(\d{3})$/);
  return match ? match[1] : null;
}

export function inferProgramFromStudentId(
  studentId: string | null | undefined
): StudentProgramInference {
  const normalized = normalizeStudentId(studentId);

  if (!normalized) {
    return {
      inferredDepartmentCode: null,
      inferredProgramCode: null,
      inferredVariant: null,
      reason: "No student ID available for inference.",
    };
  }

  const exact = EXACT_OVERRIDES.find((item) => item.studentId === normalized);
  if (exact) {
    return {
      inferredDepartmentCode: exact.departmentCode,
      inferredProgramCode: exact.programCode,
      inferredVariant: exact.variant,
      reason: exact.reason,
    };
  }

  const suffix = getStudentIdSuffix(normalized);
  if (!suffix) {
    return {
      inferredDepartmentCode: null,
      inferredProgramCode: null,
      inferredVariant: null,
      reason: "Could not extract student-id suffix.",
    };
  }

  const suffixRule = SUFFIX_RULES.find((item) => item.suffix === suffix);
  if (suffixRule) {
    return {
      inferredDepartmentCode: suffixRule.departmentCode,
      inferredProgramCode: suffixRule.programCode,
      inferredVariant: suffixRule.variant,
      reason: suffixRule.reason,
    };
  }

  return {
    inferredDepartmentCode: null,
    inferredProgramCode: null,
    inferredVariant: null,
    reason: `No suffix rule found for ${suffix}.`,
  };
}

export function matchSelectedProgramToInference(
  selectedProgramCode: string,
  inferredProgramCode: string | null,
  inferredVariant: string | null
) {
  const selected = String(selectedProgramCode || "").trim().toUpperCase();
  const inferred = String(inferredProgramCode || "").trim().toUpperCase();

  if (!selected || !inferred) return true;
  if (selected === inferred) return true;

  if (inferredVariant && selected.includes(`-${inferredVariant}`)) {
    return selected.startsWith(inferred.split(`-${inferredVariant}`)[0]);
  }

  return false;
}
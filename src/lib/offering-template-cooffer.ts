type PendingManualCoofferMeta = {
  sourceProgramCode?: string;
  section?: string;
  batchCode?: string;
  importedFrom?: string;
};

function normalizeUpper(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function buildPendingManualCoofferNote(input: PendingManualCoofferMeta) {
  const payload = {
    sourceProgramCode: normalizeUpper(input.sourceProgramCode),
    section: normalizeUpper(input.section),
    batchCode: normalizeUpper(input.batchCode),
    importedFrom: input.importedFrom || "prepared-offering-template",
  };

  return `PENDING_COOFFER::${JSON.stringify(payload)}`;
}

export function parsePendingManualCoofferNote(note: string | null | undefined): PendingManualCoofferMeta {
  const text = String(note || "").trim();

  if (!text.startsWith("PENDING_COOFFER::")) {
    return {};
  }

  const raw = text.slice("PENDING_COOFFER::".length);

  try {
    const parsed = JSON.parse(raw);
    return {
      sourceProgramCode: normalizeUpper(parsed.sourceProgramCode),
      section: normalizeUpper(parsed.section),
      batchCode: normalizeUpper(parsed.batchCode),
      importedFrom: String(parsed.importedFrom || ""),
    };
  } catch {
    return {};
  }
}

type AutoResolveArgs = {
  tx: any;
  currentOfferedCourseId: number;
  currentCourseCode: string;
  currentSection: string;
};

export async function tryAutoResolvePendingManualCoofferForImportedSection({
  tx,
  currentOfferedCourseId,
  currentCourseCode,
  currentSection,
}: AutoResolveArgs) {
  const current = await tx.offered_courses.findUnique({
    where: { id: currentOfferedCourseId },
    include: {
      offerings: {
        select: {
          academic_term_id: true,
        },
      },
    },
  });

  if (!current) {
    return { autoLinked: false, reason: "CURRENT_SECTION_NOT_FOUND" };
  }

  if (current.primary_offered_course_id) {
    return { autoLinked: false, reason: "ALREADY_LINKED_AS_SECONDARY" };
  }

  const manualRows = await tx.offered_course_manual_cooffers.findMany({
    where: {
      manual_course_code: normalizeUpper(currentCourseCode),
    },
    include: {
      offered_courses: {
        include: {
          offerings: {
            select: {
              academic_term_id: true,
            },
          },
        },
      },
    },
  });

  const candidates = manualRows.filter((row: any) => {
    if (!row.offered_courses) return false;
    if (row.offered_course_id === currentOfferedCourseId) return false;
    if (row.offered_courses.primary_offered_course_id) return false;
    if (row.offered_courses.offering_id === current.offering_id) return false;
    if (row.offered_courses.offerings?.academic_term_id !== current.offerings?.academic_term_id) {
      return false;
    }

    const meta = parsePendingManualCoofferNote(row.note);
    if (meta.section && meta.section !== normalizeUpper(currentSection)) {
      return false;
    }

    return true;
  });

  const uniquePrimaryIds = Array.from(
    new Set(candidates.map((row: any) => row.offered_course_id))
  );

  if (uniquePrimaryIds.length !== 1) {
    return {
      autoLinked: false,
      reason:
        uniquePrimaryIds.length === 0
          ? "NO_PENDING_PRIMARY_MATCH"
          : "MULTIPLE_PENDING_PRIMARY_MATCHES",
    };
  }

  const primaryOfferedCourseId = uniquePrimaryIds[0];

  await tx.offered_courses.update({
    where: { id: currentOfferedCourseId },
    data: {
      primary_offered_course_id: primaryOfferedCourseId,
      is_cooffered: true,
    },
  });

  await tx.offered_courses.update({
    where: { id: primaryOfferedCourseId },
    data: {
      is_cooffered: true,
    },
  });

  await tx.offered_course_manual_cooffers.deleteMany({
    where: {
      offered_course_id: primaryOfferedCourseId,
      manual_course_code: normalizeUpper(currentCourseCode),
    },
  });

  return {
    autoLinked: true,
    primaryOfferedCourseId,
  };
}
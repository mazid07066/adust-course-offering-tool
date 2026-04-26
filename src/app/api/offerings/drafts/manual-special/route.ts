import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

const ROUTE_VERSION = "manual-special-offering-with-real-cooffer-v2";

type CatalogProgram = {
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: string;
  curriculumVersion: string;
  curriculumKey: string | null;
  studentIdSuffix: string | null;
  displayLabel: string;
};

type ParsedLinkedCourseLine = {
  targetProgramCode: string;
  courseCode: string;
  courseTitle: string;
  credit: number;
  courseType: string;
  batchCodes: string[];
  notes: string | null;
};

type ParsedAliasLine = {
  targetProgramCode: string | null;
  manualCourseCode: string;
  note: string | null;
};

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTitle(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeCourseCode(value: unknown) {
  return normalizeText(value).toUpperCase().replace(/\s+/g, "");
}

function normalizeSection(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function normalizeCourseType(rawType: unknown, rawTitle: unknown) {
  const type = normalizeText(rawType).toUpperCase();
  const title = normalizeText(rawTitle).toUpperCase();

  if (type.includes("LAB") || title.includes(" LAB")) return "LAB";
  if (type.includes("PROJECT") || title.includes("PROJECT")) return "PROJECT";
  if (type.includes("INTERNSHIP") || title.includes("INTERNSHIP")) return "INTERNSHIP";
  return "THEORY";
}

function parseCredit(value: unknown) {
  const numeric = Number(String(value || "").trim());
  return Number.isFinite(numeric) ? numeric : NaN;
}

function parseBatchCodesText(value: unknown) {
  const text = String(value || "");
  return Array.from(
    new Set(
      text
        .split(",")
        .map((item) => normalizeText(item).toUpperCase())
        .filter(Boolean)
    )
  );
}

function parseLinkedCoursesText(value: unknown): ParsedLinkedCourseLine[] {
  const raw = String(value || "");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const out: ParsedLinkedCourseLine[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const parts = line.split("|").map((item) => normalizeText(item));

    if (parts.length < 6) {
      throw new Error(
        `Linked secondary line ${i + 1} is invalid. Expected format: PROGRAM_CODE | COURSE_CODE | COURSE_TITLE | CREDIT | COURSE_TYPE | BATCH1,BATCH2 | NOTES`
      );
    }

    const targetProgramCode = parts[0].toUpperCase();
    const courseCode = normalizeCourseCode(parts[1]);
    const courseTitle = parts[2];
    const credit = parseCredit(parts[3]);
    const courseType = normalizeCourseType(parts[4], parts[2]);
    const batchCodes = parseBatchCodesText(parts[5]);
    const notes = parts[6] ? parts[6] : null;

    if (!targetProgramCode) {
      throw new Error(`Linked secondary line ${i + 1}: target program code is required.`);
    }

    if (!courseCode) {
      throw new Error(`Linked secondary line ${i + 1}: course code is required.`);
    }

    if (!courseTitle) {
      throw new Error(`Linked secondary line ${i + 1}: course title is required.`);
    }

    if (!Number.isFinite(credit) || credit <= 0) {
      throw new Error(`Linked secondary line ${i + 1}: valid credit is required.`);
    }

    out.push({
      targetProgramCode,
      courseCode,
      courseTitle,
      credit,
      courseType,
      batchCodes,
      notes,
    });
  }

  return out;
}

function parseManualAliasCodesText(value: unknown): ParsedAliasLine[] {
  const raw = String(value || "");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const out: ParsedAliasLine[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const parts = line.split("|").map((item) => normalizeText(item));

    if (parts.length === 2) {
      const manualCourseCode = normalizeCourseCode(parts[0]);
      const note = parts[1] || null;

      if (!manualCourseCode) {
        throw new Error(`Manual alias line ${i + 1}: manual course code is required.`);
      }

      out.push({
        targetProgramCode: null,
        manualCourseCode,
        note,
      });
      continue;
    }

    if (parts.length >= 3) {
      const targetProgramCode = parts[0].toUpperCase() || null;
      const manualCourseCode = normalizeCourseCode(parts[1]);
      const note = parts[2] || null;

      if (!manualCourseCode) {
        throw new Error(`Manual alias line ${i + 1}: manual course code is required.`);
      }

      out.push({
        targetProgramCode,
        manualCourseCode,
        note,
      });
      continue;
    }

    throw new Error(
      `Manual alias line ${i + 1} is invalid. Use either MANUAL_COURSE_CODE | NOTE or TARGET_PROGRAM_CODE | MANUAL_COURSE_CODE | NOTE`
    );
  }

  return out;
}

async function getCatalogProgramByCode(programCode: string): Promise<CatalogProgram | null> {
  const row = await prisma.academic_catalog_entries.findFirst({
    where: {
      program_code: programCode,
      is_active: true,
    },
  });

  if (!row) return null;

  return {
    departmentCode: row.department_code,
    departmentName: row.department_name,
    programCode: row.program_code,
    programTitle: row.program_title,
    programType: row.program_type,
    studyShift: row.study_shift,
    curriculumVersion: row.curriculum_version,
    curriculumKey: row.curriculum_key,
    studentIdSuffix: row.student_id_suffix,
    displayLabel: row.display_label,
  };
}

async function resolveProgramAndCurriculum(programCode: string) {
  const catalogProgram = await getCatalogProgramByCode(programCode);

  if (!catalogProgram) {
    throw new Error(`Academic identity ${programCode} is not defined in academic setup.`);
  }

  const program = await resolveCanonicalProgram({
    department_code: catalogProgram.departmentCode,
    department_name: catalogProgram.departmentName,
    program_code: catalogProgram.programCode,
    program_title: catalogProgram.programTitle,
    study_shift: catalogProgram.studyShift,
  });

  const curriculumKey =
    normalizeText(catalogProgram.curriculumKey).toUpperCase() || catalogProgram.programCode;

  return {
    catalogProgram,
    program,
    curriculumKey,
  };
}

async function findOrCreateSpecialMasterCourse(params: {
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
  programId: number;
  curriculumKey: string;
  courseCode: string;
  courseTitle: string;
  credit: number;
  courseType: string;
  levelTerm: string;
  groupName: string;
}) {
  const existing = await params.tx.master_courses.findFirst({
    where: {
      OR: [
        {
          program_id: params.programId,
          course_code: params.courseCode,
        },
        {
          curriculum_key: params.curriculumKey,
          course_code: params.courseCode,
        },
      ],
    },
    orderBy: {
      id: "asc",
    },
  });

  if (!existing) {
    const created = await params.tx.master_courses.create({
      data: {
        program_id: params.programId,
        curriculum_key: params.curriculumKey,
        course_code: params.courseCode,
        course_title: params.courseTitle,
        normalized_title: normalizeTitle(params.courseTitle),
        credit: params.credit,
        course_type: params.courseType,
        level_term: params.levelTerm,
        group_name: params.groupName,
        is_active: true,
      },
    });

    return {
      masterCourse: created,
      created: true,
      reused: false,
    };
  }

  const existingTitle = normalizeTitle(existing.course_title);
  const inputTitle = normalizeTitle(params.courseTitle);
  const existingCredit = Number(existing.credit || 0);
  const existingType = normalizeText(existing.course_type).toUpperCase();

  const safeSpecialManual =
    normalizeText(existing.group_name).toUpperCase() === "SPECIAL_MANUAL" ||
    normalizeText(existing.level_term).toUpperCase() === "SPECIAL";

  const hasConflict =
    existingTitle !== inputTitle ||
    existingCredit !== params.credit ||
    existingType !== params.courseType;

  if (hasConflict && !safeSpecialManual) {
    throw new Error(
      `Master course conflict for ${params.courseCode}. Existing title / credit / type differs in the target curriculum. Use a distinct special code or reuse the existing definition.`
    );
  }

  if (safeSpecialManual) {
    const updated = await params.tx.master_courses.update({
      where: {
        id: existing.id,
      },
      data: {
        program_id: params.programId,
        curriculum_key: params.curriculumKey,
        course_code: params.courseCode,
        course_title: params.courseTitle,
        normalized_title: normalizeTitle(params.courseTitle),
        credit: params.credit,
        course_type: params.courseType,
        level_term: params.levelTerm,
        group_name: params.groupName,
        is_active: true,
      },
    });

    return {
      masterCourse: updated,
      created: false,
      reused: true,
    };
  }

  return {
    masterCourse: existing,
    created: false,
    reused: true,
  };
}

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  return NextResponse.json({
    ok: true,
    routeVersion: ROUTE_VERSION,
    message: "Manual special offering route is active.",
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();

    const draftId = Number(body.draftId);
    const primaryCourseCode = normalizeCourseCode(body.primaryCourseCode);
    const primaryCourseTitle = normalizeText(body.primaryCourseTitle);
    const section = normalizeSection(body.section);
    const credit = parseCredit(body.credit);
    const courseType = normalizeCourseType(body.courseType, body.primaryCourseTitle);
    const levelTerm = normalizeText(body.levelTerm).toUpperCase() || "SPECIAL";
    const groupName = normalizeText(body.groupName).toUpperCase() || "SPECIAL_MANUAL";
    const primaryBatchCodes = parseBatchCodesText(body.primaryBatchCodesText);
    const primaryNotes = normalizeText(body.primaryNotes) || null;

    const linkedCourses = parseLinkedCoursesText(body.linkedCoursesText);
    const manualAliasCodes = parseManualAliasCodesText(body.manualAliasCodesText);

    if (!Number.isFinite(draftId) || draftId <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "Valid draftId is required.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    if (!primaryCourseCode) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "Primary course code is required.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    if (!primaryCourseTitle) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "Primary course title is required.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    if (!section) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "Section is required.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(credit) || credit <= 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "Valid credit is required.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    const draft = await prisma.offerings.findUnique({
      where: {
        id: draftId,
      },
      include: {
        academic_terms: true,
        programs: true,
      },
    });

    if (!draft) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error: "Selected draft offering was not found.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 404 }
      );
    }

    if (draft.status !== "DRAFT") {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        {
          ok: false,
          error:
            "Manual special course entry is allowed only while the offering is in DRAFT status.",
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    const primaryProgramCode = draft.programs.short_name;

    const {
      program: primaryProgram,
      curriculumKey: primaryCurriculumKey,
    } = await resolveProgramAndCurriculum(primaryProgramCode);

    const linkedProgramMap = new Map<
      string,
      {
        catalogProgram: CatalogProgram;
        programId: number;
        programCode: string;
        curriculumKey: string;
      }
    >();

    for (const item of linkedCourses) {
      if (normalizeText(item.targetProgramCode) === normalizeText(primaryProgramCode)) {
        throw new Error(
          `Linked secondary target program ${item.targetProgramCode} cannot be the same as the primary draft program ${primaryProgramCode}.`
        );
      }

      if (!linkedProgramMap.has(item.targetProgramCode)) {
        const resolved = await resolveProgramAndCurriculum(item.targetProgramCode);
        linkedProgramMap.set(item.targetProgramCode, {
          catalogProgram: resolved.catalogProgram,
          programId: resolved.program.id,
          programCode: resolved.program.short_name,
          curriculumKey: resolved.curriculumKey,
        });
      }
    }

    const linkedDraftsByProgramId = new Map<number, { id: number; status: string }>();

    for (const [, item] of linkedProgramMap) {
      const linkedDraft = await prisma.offerings.findFirst({
        where: {
          academic_term_id: draft.academic_term_id,
          program_id: item.programId,
          status: "DRAFT",
        },
        select: {
          id: true,
          status: true,
        },
        orderBy: {
          id: "desc",
        },
      });

      if (!linkedDraft) {
        throw new Error(
          `No DRAFT offering exists in ${draft.academic_terms.name} for linked program ${item.programCode}. Create/load that draft first.`
        );
      }

      linkedDraftsByProgramId.set(item.programId, linkedDraft);
    }

    const result = await prisma.$transaction(async (tx) => {
      const primaryMaster = await findOrCreateSpecialMasterCourse({
        tx,
        programId: primaryProgram.id,
        curriculumKey: primaryCurriculumKey,
        courseCode: primaryCourseCode,
        courseTitle: primaryCourseTitle,
        credit,
        courseType,
        levelTerm,
        groupName,
      });

      const duplicatePrimary = await tx.offered_courses.findFirst({
        where: {
          offering_id: draft.id,
          section,
          master_courses: {
            is: {
              program_id: primaryProgram.id,
              course_code: primaryCourseCode,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicatePrimary) {
        throw new Error(
          "This DRAFT already contains the same primary course code and section."
        );
      }

      const primaryBatchRows =
        primaryBatchCodes.length > 0
          ? await tx.batches.findMany({
              where: {
                program_id: primaryProgram.id,
                batch_code: {
                  in: primaryBatchCodes,
                },
              },
              select: {
                id: true,
                batch_code: true,
              },
            })
          : [];

      if (primaryBatchCodes.length > 0) {
        const foundCodes = new Set(primaryBatchRows.map((row) => row.batch_code));
        const missing = primaryBatchCodes.filter((code) => !foundCodes.has(code));

        if (missing.length > 0) {
          throw new Error(
            `These primary batch code(s) do not exist under ${primaryProgram.short_name}: ${missing.join(", ")}`
          );
        }
      }

      const primaryOfferedCourse = await tx.offered_courses.create({
        data: {
          offering_id: draft.id,
          master_course_id: primaryMaster.masterCourse.id,
          section,
          is_cooffered: linkedCourses.length > 0,
          primary_offered_course_id: null,
          notes: primaryNotes,
        },
      });

      if (primaryBatchRows.length > 0) {
        await tx.offered_course_batches.createMany({
          data: primaryBatchRows.map((row) => ({
            offered_course_id: primaryOfferedCourse.id,
            batch_id: row.id,
          })),
        });
      }

      if (manualAliasCodes.length > 0) {
        await tx.offered_course_manual_cooffers.createMany({
          data: manualAliasCodes.map((item) => ({
            offered_course_id: primaryOfferedCourse.id,
            target_program_code: item.targetProgramCode,
            manual_course_code: item.manualCourseCode,
            note: item.note,
          })),
        });
      }

      let createdSecondaryMasterCourseCount = 0;
      let reusedSecondaryMasterCourseCount = 0;

      const createdSecondaryRows: Array<{
        offeredCourseId: number;
        programCode: string;
        courseCode: string;
        attachedBatchCodes: string[];
      }> = [];

      for (const linked of linkedCourses) {
        const linkedProgramInfo = linkedProgramMap.get(linked.targetProgramCode);

        if (!linkedProgramInfo) {
          throw new Error(
            `Linked program info not found for ${linked.targetProgramCode}.`
          );
        }

        const linkedDraft = linkedDraftsByProgramId.get(linkedProgramInfo.programId);

        if (!linkedDraft) {
          throw new Error(
            `Linked DRAFT offering not found for ${linkedProgramInfo.programCode}.`
          );
        }

        const linkedMaster = await findOrCreateSpecialMasterCourse({
          tx,
          programId: linkedProgramInfo.programId,
          curriculumKey: linkedProgramInfo.curriculumKey,
          courseCode: linked.courseCode,
          courseTitle: linked.courseTitle,
          credit: linked.credit,
          courseType: linked.courseType,
          levelTerm,
          groupName,
        });

        if (linkedMaster.created) {
          createdSecondaryMasterCourseCount += 1;
        } else if (linkedMaster.reused) {
          reusedSecondaryMasterCourseCount += 1;
        }

        const duplicateSecondary = await tx.offered_courses.findFirst({
          where: {
            offering_id: linkedDraft.id,
            section,
            master_courses: {
              is: {
                program_id: linkedProgramInfo.programId,
                course_code: linked.courseCode,
              },
            },
          },
          select: {
            id: true,
          },
        });

        if (duplicateSecondary) {
          throw new Error(
            `Duplicate linked secondary detected for ${linkedProgramInfo.programCode} | ${linked.courseCode} | Sec-${section}.`
          );
        }

        const linkedBatchRows =
          linked.batchCodes.length > 0
            ? await tx.batches.findMany({
                where: {
                  program_id: linkedProgramInfo.programId,
                  batch_code: {
                    in: linked.batchCodes,
                  },
                },
                select: {
                  id: true,
                  batch_code: true,
                },
              })
            : [];

        if (linked.batchCodes.length > 0) {
          const foundCodes = new Set(linkedBatchRows.map((row) => row.batch_code));
          const missing = linked.batchCodes.filter((code) => !foundCodes.has(code));

          if (missing.length > 0) {
            throw new Error(
              `These linked batch code(s) do not exist under ${linkedProgramInfo.programCode}: ${missing.join(", ")}`
            );
          }
        }

        const linkedOfferedCourse = await tx.offered_courses.create({
          data: {
            offering_id: linkedDraft.id,
            master_course_id: linkedMaster.masterCourse.id,
            section,
            is_cooffered: true,
            primary_offered_course_id: primaryOfferedCourse.id,
            notes: linked.notes,
          },
        });

        if (linkedBatchRows.length > 0) {
          await tx.offered_course_batches.createMany({
            data: linkedBatchRows.map((row) => ({
              offered_course_id: linkedOfferedCourse.id,
              batch_id: row.id,
            })),
          });
        }

        createdSecondaryRows.push({
          offeredCourseId: linkedOfferedCourse.id,
          programCode: linkedProgramInfo.programCode,
          courseCode: linked.courseCode,
          attachedBatchCodes: linkedBatchRows.map((row) => row.batch_code),
        });
      }

      return {
        primaryOfferedCourseId: primaryOfferedCourse.id,
        createdPrimaryMasterCourse: primaryMaster.created,
        reusedPrimaryMasterCourse: primaryMaster.reused,
        attachedPrimaryBatchCodes: primaryBatchRows.map((row) => row.batch_code),
        linkedSecondaryCount: createdSecondaryRows.length,
        manualAliasCount: manualAliasCodes.length,
        createdSecondaryMasterCourseCount,
        reusedSecondaryMasterCourseCount,
        createdSecondaryRows,
      };
    });

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      ok: true,
      routeVersion: ROUTE_VERSION,
      message:
        "Manual special primary course created successfully. Real linked secondary co-offered rows were added into their target DRAFT offerings, so they will flow through the normal system and appear in faculty-choice like regular offerings.",
      draftId: draft.id,
      primaryOfferedCourseId: result.primaryOfferedCourseId,
      linkedSecondaryCount: result.linkedSecondaryCount,
      manualAliasCount: result.manualAliasCount,
      createdPrimaryMasterCourse: result.createdPrimaryMasterCourse,
      reusedPrimaryMasterCourse: result.reusedPrimaryMasterCourse,
      createdSecondaryMasterCourseCount: result.createdSecondaryMasterCourseCount,
      reusedSecondaryMasterCourseCount: result.reusedSecondaryMasterCourseCount,
      attachedPrimaryBatchCodes: result.attachedPrimaryBatchCodes,
      createdSecondaryRows: result.createdSecondaryRows,
    });
  } catch (error) {
    console.error("MANUAL SPECIAL OFFERING ERROR", error);

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create manual special offering entry.",
        routeVersion: ROUTE_VERSION,
      },
      { status: 500 }
    );
  }
}
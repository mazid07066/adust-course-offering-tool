import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getCatalogProgramByCode,
  getCatalogProgramOptions,
} from "@/lib/academic-catalog";
import { resolveCanonicalProgram } from "@/lib/canonical-program";
import { getExcludedBatchIdsForTerm } from "@/lib/batch-term-offering-status";

type ProgramCandidate = {
  id: number;
  short_name: string;
  name: string;
  source:
    | "EXACT_PROGRAM_CODE"
    | "CANONICAL_PROGRAM"
    | "CURRICULUM_RELATED_PROGRAM";
};

function normalizeUpper(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function uniqueById<T extends { id: number }>(rows: T[]) {
  const seen = new Set<number>();
  const out: T[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

function sourcePriority(source: ProgramCandidate["source"]) {
  if (source === "CANONICAL_PROGRAM") return 1;
  if (source === "EXACT_PROGRAM_CODE") return 2;
  return 3;
}

function offeringStatusPriority(status: string) {
  const clean = normalizeUpper(status);

  if (clean === "FACULTY_CHOICE_FINALIZED") return 1;
  if (clean === "FACULTY_CHOICE_BUFFER") return 2;
  if (clean === "BUFFER_READY") return 3;
  if (clean === "DRAFT") return 4;
  if (clean === "CONFIRMED") return 99;

  return 50;
}

async function getProgramCandidates(programCode: string): Promise<{
  requestedProgramCode: string;
  candidateIds: number[];
  candidates: ProgramCandidate[];
}> {
  const normalizedProgramCode = normalizeUpper(programCode);

  if (!normalizedProgramCode) {
    return {
      requestedProgramCode: "",
      candidateIds: [],
      candidates: [],
    };
  }

  const staticCatalog = getCatalogProgramByCode(normalizedProgramCode);

  if (!staticCatalog) {
    throw new Error("Invalid academic identity programCode.");
  }

  const catalogEntry = await prisma.academic_catalog_entries.findUnique({
    where: {
      program_code: normalizedProgramCode,
    },
    select: {
      program_code: true,
      curriculum_key: true,
      department_code: true,
      department_name: true,
      program_title: true,
      study_shift: true,
    },
  });

  const candidates: ProgramCandidate[] = [];

  const exactProgram = await prisma.programs.findFirst({
    where: {
      short_name: normalizedProgramCode,
    },
    select: {
      id: true,
      short_name: true,
      name: true,
    },
  });

  if (exactProgram) {
    candidates.push({
      ...exactProgram,
      source: "EXACT_PROGRAM_CODE",
    });
  }

  const canonicalProgram = await resolveCanonicalProgram({
    department_code:
      catalogEntry?.department_code || staticCatalog.departmentCode,
    department_name:
      catalogEntry?.department_name || staticCatalog.departmentName,
    program_code: normalizedProgramCode,
    program_title: catalogEntry?.program_title || staticCatalog.programTitle,
    study_shift: catalogEntry?.study_shift || staticCatalog.studyShift,
  });

  if (!candidates.some((item) => item.id === canonicalProgram.id)) {
    candidates.push({
      id: canonicalProgram.id,
      short_name: canonicalProgram.short_name,
      name: canonicalProgram.name,
      source: "CANONICAL_PROGRAM",
    });
  }

  const curriculumKey = catalogEntry?.curriculum_key || null;

  if (curriculumKey) {
    const relatedCatalogEntries = await prisma.academic_catalog_entries.findMany({
      where: {
        curriculum_key: curriculumKey,
        is_active: true,
      },
      select: {
        program_code: true,
      },
    });

    const relatedProgramCodes = relatedCatalogEntries
      .map((item) => item.program_code)
      .filter(Boolean);

    if (relatedProgramCodes.length > 0) {
      const relatedPrograms = await prisma.programs.findMany({
        where: {
          short_name: {
            in: relatedProgramCodes,
          },
        },
        select: {
          id: true,
          short_name: true,
          name: true,
        },
      });

      for (const item of relatedPrograms) {
        if (!candidates.some((row) => row.id === item.id)) {
          candidates.push({
            ...item,
            source: "CURRICULUM_RELATED_PROGRAM",
          });
        }
      }
    }
  }

  const uniqueCandidates = uniqueById(candidates);

  return {
    requestedProgramCode: normalizedProgramCode,
    candidateIds: uniqueCandidates.map((item) => item.id),
    candidates: uniqueCandidates,
  };
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);

    const programCode = normalizeUpper(searchParams.get("programCode"));
    const termName = normalizeUpper(searchParams.get("termName"));

    const [terms, rooms, teachers, catalogProgramsFromDb] = await Promise.all([
      prisma.academic_terms.findMany({
        orderBy: [{ year: "desc" }, { id: "desc" }],
        select: {
          id: true,
          name: true,
          year: true,
          term_type: true,
          is_active: true,
        },
      }),

      prisma.rooms.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ room_code: "asc" }],
        select: {
          id: true,
          room_code: true,
          room_type: true,
          capacity: true,
        },
      }),

      prisma.teachers.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ teacher_code: "asc" }],
        include: {
          departments: true,
        },
      }),

      prisma.academic_catalog_entries.findMany({
        where: {
          is_active: true,
        },
        orderBy: [{ program_code: "asc" }],
        select: {
          id: true,
          program_code: true,
          display_label: true,
          department_code: true,
          department_name: true,
          program_title: true,
        },
      }),
    ]);

    const programs =
      catalogProgramsFromDb.length > 0
        ? catalogProgramsFromDb.map((item) => ({
            id: item.id,
            programCode: item.program_code,
            programName: item.program_title,
            departmentCode: item.department_code,
            departmentName: item.department_name,
            displayLabel: `${item.program_code} - ${item.display_label}`,
          }))
        : getCatalogProgramOptions().map((item, index) => ({
            id: index + 1,
            programCode: item.programCode,
            programName: item.programTitle,
            departmentCode: item.departmentCode,
            departmentName: item.departmentName,
            displayLabel: `${item.programCode} - ${item.displayLabel}`,
          }));

    const selectedTerm = termName
      ? await prisma.academic_terms.findFirst({
          where: {
            name: termName,
          },
          select: {
            id: true,
            name: true,
          },
        })
      : null;

    const resolved = programCode
      ? await getProgramCandidates(programCode)
      : {
          requestedProgramCode: "",
          candidateIds: [],
          candidates: [] as ProgramCandidate[],
        };

    const programPriorityMap = new Map<number, number>();
    for (const candidate of resolved.candidates) {
      programPriorityMap.set(candidate.id, sourcePriority(candidate.source));
    }

    const [rawBatches, rawCourses, rawOfferings] = await Promise.all([
      resolved.candidateIds.length > 0
        ? prisma.batches.findMany({
            where: {
              program_id: {
                in: resolved.candidateIds,
              },
              is_active: true,
            },
            orderBy: [{ batch_code: "asc" }, { id: "asc" }],
            select: {
              id: true,
              batch_code: true,
              admission_term: true,
              program_id: true,
            },
          })
        : Promise.resolve([]),

      resolved.candidateIds.length > 0
        ? prisma.master_courses.findMany({
            where: {
              program_id: {
                in: resolved.candidateIds,
              },
              is_active: true,
            },
            orderBy: [{ course_code: "asc" }, { id: "asc" }],
            select: {
              id: true,
              program_id: true,
              course_code: true,
              course_title: true,
              credit: true,
              course_type: true,
              level_term: true,
              group_name: true,
            },
          })
        : Promise.resolve([]),

      resolved.candidateIds.length > 0 && selectedTerm
        ? prisma.offerings.findMany({
            where: {
              program_id: {
                in: resolved.candidateIds,
              },
              academic_term_id: selectedTerm.id,
            },
            orderBy: [{ id: "desc" }],
            include: {
              programs: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const bestBatchByCode = new Map<string, (typeof rawBatches)[number]>();
    for (const batch of rawBatches) {
      const code = String(batch.batch_code || "").trim();
      if (!code) continue;

      const existing = bestBatchByCode.get(code);

      if (!existing) {
        bestBatchByCode.set(code, batch);
        continue;
      }

      const currentPriority = programPriorityMap.get(batch.program_id) ?? 999;
      const existingPriority = programPriorityMap.get(existing.program_id) ?? 999;

      if (currentPriority < existingPriority) {
        bestBatchByCode.set(code, batch);
      }
    }

    const deduplicatedBatches = [...bestBatchByCode.values()];

    const excludedBatchIds =
      selectedTerm && deduplicatedBatches.length > 0
        ? await getExcludedBatchIdsForTerm(
            selectedTerm.id,
            deduplicatedBatches.map((batch) => batch.id)
          )
        : new Set<number>();

    const eligibleBatches = deduplicatedBatches.filter(
      (batch) => !excludedBatchIds.has(batch.id)
    );

    const bestCourseByCode = new Map<string, (typeof rawCourses)[number]>();
    for (const course of rawCourses) {
      const code = String(course.course_code || "").replace(/\s+/g, "").toUpperCase();
      if (!code) continue;

      const existing = bestCourseByCode.get(code);

      if (!existing) {
        bestCourseByCode.set(code, course);
        continue;
      }

      const currentPriority = programPriorityMap.get(course.program_id) ?? 999;
      const existingPriority =
        programPriorityMap.get(existing.program_id) ?? 999;

      if (currentPriority < existingPriority) {
        bestCourseByCode.set(code, course);
      }
    }

    const sortedOfferings = [...rawOfferings].sort((a, b) => {
      const statusDiff =
        offeringStatusPriority(a.status) - offeringStatusPriority(b.status);
      if (statusDiff !== 0) return statusDiff;
      return b.id - a.id;
    });

    const recommendedOfferingId =
      sortedOfferings.find((item) => item.status !== "CONFIRMED")?.id ?? null;

    return NextResponse.json({
      success: true,
      terms: terms.map((term) => ({
        id: term.id,
        name: term.name,
        year: term.year,
        termType: term.term_type,
        active: Boolean(term.is_active),
      })),
      programs,
      resolvedPrograms: resolved.candidates.map((item) => ({
        id: item.id,
        programCode: item.short_name,
        programName: item.name,
        source: item.source,
      })),
      batches: eligibleBatches.map((batch) => ({
        id: batch.id,
        batchCode: batch.batch_code,
        admissionTerm: batch.admission_term,
      })),
      courses: [...bestCourseByCode.values()].map((course) => ({
        id: course.id,
        courseCode: course.course_code,
        courseTitle: course.course_title,
        credit: Number(course.credit || 0),
        courseType: course.course_type,
        levelTerm: course.level_term,
        groupName: course.group_name,
      })),
      rooms: rooms.map((room) => ({
        id: room.id,
        roomCode: room.room_code,
        roomType: room.room_type,
        capacity: room.capacity,
      })),
      teachers: teachers.map((teacher) => ({
        id: teacher.id,
        teacherCode: teacher.teacher_code,
        fullName: teacher.full_name,
        designation: teacher.designation,
        seniorityLevel: teacher.seniority_level,
        departmentCode: teacher.departments?.short_name || "-",
        displayLabel: `${teacher.teacher_code} - ${teacher.full_name}`,
      })),
      existingOfferings: sortedOfferings.map((offering) => ({
        id: offering.id,
        status: offering.status,
        programCode: offering.programs.short_name,
        programName: offering.programs.name,
        createdAt: offering.created_at,
        recommended: offering.id === recommendedOfferingId,
      })),
      recommendedOfferingId,
    });
  } catch (error) {
    console.error("Manual offering options failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load manual offering options.",
      },
      { status: 500 }
    );
  }
}

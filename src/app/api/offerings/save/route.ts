import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  addDuration,
  analyzeOfferingConflicts,
  OfferingRowInput,
  normalizeCourseCode,
  normalizeTitle,
} from "@/lib/offering-conflicts";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

function parseAcademicTerm(termName: string) {
  const match = termName.trim().toUpperCase().match(/^(SPRING|SUMMER|FALL)\s+(\d{4})$/);

  if (!match) {
    throw new Error(`Invalid academic term format: ${termName}`);
  }

  return {
    season: match[1],
    year: Number(match[2]),
  };
}

type SaveRow =
  | {
      mode?: "NEW";
      master_course_id: number;
      section: string;
      faculty_id: number;
      batch_ids: number[];
      meetings: Array<{
        day_of_week: string;
        start_time: string;
        duration_hours: number;
        room_id: number;
      }>;
    }
  | {
      mode: "REUSE";
      reusable_offered_course_id: number;
      batch_ids: number[];
    };

async function validateBatchEligibilityForExistingCourse(
  batchIds: number[],
  courseCode: string,
  courseTitle: string
) {
  const completed = await prisma.batch_completed_courses.findMany({
    where: {
      batch_id: { in: batchIds },
    },
  });

  const current = await prisma.batch_current_registrations.findMany({
    where: {
      batch_id: { in: batchIds },
    },
  });

  const codeKey = normalizeCourseCode(courseCode);
  const titleKey = normalizeTitle(courseTitle);

  const errors: string[] = [];

  for (const batchId of batchIds) {
    const isCompleted = completed.some(
      (c) =>
        c.batch_id === batchId &&
        (
          normalizeCourseCode(c.course_code) === codeKey ||
          normalizeTitle(c.normalized_title || c.course_title) === titleKey
        )
    );

    const isOngoing = current.some(
      (c) =>
        c.batch_id === batchId &&
        (
          normalizeCourseCode(c.course_code) === codeKey ||
          normalizeTitle(c.normalized_title || c.course_title) === titleKey
        )
    );

    if (isCompleted) {
      errors.push(`Batch ID ${batchId} already completed ${courseCode}.`);
    } else if (isOngoing) {
      errors.push(`Batch ID ${batchId} is already taking ${courseCode}.`);
    }
  }

  return errors;
}

async function validateBatchNotAlreadyAttachedElsewhere(
  academicTermId: number,
  batchIds: number[],
  courseCode: string,
  courseTitle: string,
  excludeOfferedCourseId?: number
) {
  const existingAssignments = await prisma.offered_course_batches.findMany({
    where: {
      batch_id: {
        in: batchIds,
      },
      offered_courses: {
        offering_id: {
          not: undefined,
        },
        offerings: {
          academic_term_id: academicTermId,
          status: {
            in: ["DRAFT", "CONFIRMED"],
          },
        },
      },
    },
    include: {
      batches: true,
      offered_courses: {
        include: {
          master_courses: true,
          offerings: {
            include: {
              programs: true,
            },
          },
        },
      },
    },
  });

  const codeKey = normalizeCourseCode(courseCode);
  const titleKey = normalizeTitle(courseTitle);
  const errors: string[] = [];

  for (const item of existingAssignments) {
    if (excludeOfferedCourseId && item.offered_course_id === excludeOfferedCourseId) continue;

    const sameCourse =
      normalizeCourseCode(item.offered_courses.master_courses.course_code) === codeKey ||
      normalizeTitle(
        item.offered_courses.master_courses.normalized_title ||
        item.offered_courses.master_courses.course_title
      ) === titleKey;

    if (sameCourse) {
      errors.push(
        `Batch ${item.batches.batch_code} is already attached to ` +
        `${item.offered_courses.master_courses.course_code} section ${item.offered_courses.section} ` +
        `under ${item.offered_courses.offerings.programs.short_name} in this term.`
      );
    }
  }

  return errors;
}

export async function POST(request: NextRequest) {
  await requireCoordinatorOrAdminApi();

  try {
    const body = await request.json();

    const {
      program_id,
      batch_id,
      suggested_term_name,
      appendToConfirmed,
      rows,
    }: {
      program_id: number;
      batch_id: number;
      suggested_term_name: string;
      appendToConfirmed?: boolean;
      rows: SaveRow[];
    } = body;

    if (!program_id || !batch_id || !suggested_term_name || !Array.isArray(rows) || rows.length === 0) {
      clearReportingCacheWithLog("offering/reporting data changed");
      return NextResponse.json(
        { error: "program_id, batch_id, suggested_term_name, and rows are required" },
        { status: 400 }
      );
    }

    let term = await prisma.academic_terms.findFirst({
      where: {
        name: suggested_term_name,
      },
    });

    if (!term) {
      const parsed = parseAcademicTerm(suggested_term_name);

      term = await prisma.academic_terms.create({
        data: {
          name: suggested_term_name,
          year: parsed.year,
          term_type: parsed.season,
          is_active: true,
        },
      });
    }

    const newRows = rows.filter((r) => r.mode !== "REUSE") as OfferingRowInput[];
    const reuseRows = rows.filter((r) => r.mode === "REUSE") as Array<{
      mode: "REUSE";
      reusable_offered_course_id: number;
      batch_ids: number[];
    }>;

    if (newRows.length > 0) {
      const analysis = await analyzeOfferingConflicts(term.id, newRows);

      if (analysis.hasBlockingConflicts) {
        clearReportingCacheWithLog("offering/reporting data changed");
        return NextResponse.json(
          {
            error: analysis.conflicts[0]?.message || "Blocking conflict found.",
            conflicts: analysis.conflicts,
            warnings: analysis.warnings,
          },
          { status: 400 }
        );
      }
    }

    let targetOfferingId: number | null = null;
    let createdDraft = false;

    if (newRows.length > 0) {
      if (appendToConfirmed) {
        const existingConfirmed = await prisma.offerings.findFirst({
          where: {
            program_id,
            academic_term_id: term.id,
            status: "CONFIRMED",
          },
        });

        if (!existingConfirmed) {
          clearReportingCacheWithLog("offering/reporting data changed");
          return NextResponse.json(
            {
              error:
                "No confirmed offering exists for this home program and term. Uncheck append mode and save as draft first.",
            },
            { status: 400 }
          );
        }

        targetOfferingId = existingConfirmed.id;
      } else {
        const offering = await prisma.offerings.create({
          data: {
            academic_term_id: term.id,
            program_id,
            prepared_by_user_id: 1,
            status: "DRAFT",
          },
        });

        targetOfferingId = offering.id;
        createdDraft = true;
      }
    }

    for (const row of newRows) {
      if (!targetOfferingId) {
        clearReportingCacheWithLog("offering/reporting data changed");
        return NextResponse.json(
          { error: "Target offering was not prepared for new rows." },
          { status: 500 }
        );
      }

      const offeredCourse = await prisma.offered_courses.create({
        data: {
          offering_id: targetOfferingId,
          master_course_id: row.master_course_id,
          section: row.section,
          is_cooffered: row.batch_ids.length > 1,
          notes: null,
        },
      });

      for (const bid of row.batch_ids) {
        await prisma.offered_course_batches.create({
          data: {
            offered_course_id: offeredCourse.id,
            batch_id: bid,
          },
        });
      }

      await prisma.offered_course_teachers.create({
        data: {
          offered_course_id: offeredCourse.id,
          teacher_id: row.faculty_id,
          assigned_credit: 0,
          load_type: "ASSIGNED",
        },
      });

      for (const meeting of row.meetings) {
        await prisma.offered_course_slots.create({
          data: {
            offered_course_id: offeredCourse.id,
            day_of_week: meeting.day_of_week,
            start_time: meeting.start_time,
            end_time: addDuration(meeting.start_time, meeting.duration_hours),
            room_id: meeting.room_id,
            slot_type: meeting.duration_hours >= 2 ? "LAB" : "THEORY",
          },
        });
      }
    }

    for (const row of reuseRows) {
      const targetCourse = await prisma.offered_courses.findFirst({
        where: {
          id: row.reusable_offered_course_id,
          offerings: {
            academic_term_id: term.id,
            status: {
              in: ["DRAFT", "CONFIRMED"],
            },
          },
        },
        include: {
          offerings: {
            include: {
              programs: true,
            },
          },
          master_courses: true,
          offered_course_batches: true,
        },
      });

      if (!targetCourse) {
        clearReportingCacheWithLog("offering/reporting data changed");
        return NextResponse.json(
          { error: "Reusable section not found in the selected term." },
          { status: 404 }
        );
      }

      if (!row.batch_ids || row.batch_ids.length === 0) {
        clearReportingCacheWithLog("offering/reporting data changed");
        return NextResponse.json(
          { error: "At least one batch is required for reusable co-offering rows." },
          { status: 400 }
        );
      }

      const alreadyAttachedBatchIds = new Set(
        targetCourse.offered_course_batches.map((b) => b.batch_id)
      );

      const duplicateBatches = row.batch_ids.filter((id) => alreadyAttachedBatchIds.has(id));
      if (duplicateBatches.length > 0) {
        clearReportingCacheWithLog("offering/reporting data changed");
        return NextResponse.json(
          {
            error: `One or more selected batches are already attached to reusable section ${targetCourse.master_courses.course_code} section ${targetCourse.section}.`,
          },
          { status: 400 }
        );
      }

      const eligibilityErrors = await validateBatchEligibilityForExistingCourse(
        row.batch_ids,
        targetCourse.master_courses.course_code,
        targetCourse.master_courses.course_title
      );

      if (eligibilityErrors.length > 0) {
        clearReportingCacheWithLog("offering/reporting data changed");
        return NextResponse.json(
          { error: eligibilityErrors[0], conflicts: eligibilityErrors.map((m) => ({ message: m })) },
          { status: 400 }
        );
      }

      const duplicateAssignmentErrors = await validateBatchNotAlreadyAttachedElsewhere(
        term.id,
        row.batch_ids,
        targetCourse.master_courses.course_code,
        targetCourse.master_courses.course_title,
        targetCourse.id
      );

      if (duplicateAssignmentErrors.length > 0) {
        clearReportingCacheWithLog("offering/reporting data changed");
        return NextResponse.json(
          { error: duplicateAssignmentErrors[0], conflicts: duplicateAssignmentErrors.map((m) => ({ message: m })) },
          { status: 400 }
        );
      }

      for (const bid of row.batch_ids) {
        await prisma.offered_course_batches.create({
          data: {
            offered_course_id: targetCourse.id,
            batch_id: bid,
          },
        });
      }

      await prisma.offered_courses.update({
        where: {
          id: targetCourse.id,
        },
        data: {
          is_cooffered: true,
        },
      });
    }

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json({
      success: true,
      message:
        newRows.length > 0
          ? appendToConfirmed
            ? "New courses appended and reusable co-offerings attached successfully."
            : createdDraft
            ? "Draft offering saved and reusable co-offerings attached successfully."
            : "Offering saved successfully."
          : "Reusable co-offerings attached successfully.",
      offering_id: targetOfferingId,
      academic_term_name: term.name,
    });
  } catch (error) {
    console.error(error);

    clearReportingCacheWithLog("offering/reporting data changed");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save offering",
      },
      { status: 500 }
    );
  }
}
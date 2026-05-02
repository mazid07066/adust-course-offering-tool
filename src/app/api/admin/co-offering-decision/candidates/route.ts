import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

const VISIBLE_STATUSES = [
  "DRAFT",
  "BUFFER_READY",
  "FACULTY_CHOICE_BUFFER",
  "FACULTY_CHOICE_FINALIZED",
  "CONFIRMED",
];

const TARGET_PROGRAMS = [
  "BSC-EEE-EVE-NEW",
  "BSC-EEE-REG-NEW",
  "BSC-RAE-REG-NEW",
];

function normalize(value: unknown) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleScore(a: string, b: string) {
  const aa = new Set(normalize(a).split(" ").filter(Boolean));
  const bb = new Set(normalize(b).split(" ").filter(Boolean));

  if (aa.size === 0 || bb.size === 0) return 0;

  const common = [...aa].filter((item) => bb.has(item)).length;
  return common / Math.max(aa.size, bb.size);
}

export async function GET(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const { searchParams } = new URL(req.url);
    const termName = normalize(searchParams.get("termName"));

    if (!termName) {
      return NextResponse.json(
        { ok: false, error: "termName is required." },
        { status: 400 }
      );
    }

    const offerings = await prisma.offerings.findMany({
      where: {
        academic_terms: {
          name: termName,
        },
        status: {
          in: VISIBLE_STATUSES,
        },
        programs: {
          short_name: {
            in: TARGET_PROGRAMS,
          },
        },
      },
      include: {
        programs: true,
        academic_terms: true,
        offered_courses: {
          include: {
            master_courses: true,
            primary_offered_course: {
              include: {
                master_courses: true,
                offerings: {
                  include: {
                    programs: true,
                  },
                },
              },
            },
            secondary_offered_courses: {
              include: {
                master_courses: true,
                offerings: {
                  include: {
                    programs: true,
                  },
                },
              },
            },
            offered_course_batches: {
              include: {
                batches: true,
              },
            },
            offered_course_slots: true,
            offered_course_teachers: true,
          },
          orderBy: [{ id: "asc" }],
        },
      },
      orderBy: [{ program_id: "asc" }, { id: "asc" }],
    });

    const flatCourses = offerings.flatMap((offering) =>
      offering.offered_courses.map((course) => ({
        id: course.id,
        offeringId: offering.id,
        programCode: offering.programs.short_name,
        programName: offering.programs.name,
        offeringStatus: offering.status,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        courseTitleNorm: normalize(course.master_courses.course_title),
        credit: Number(course.master_courses.credit || 0),
        section: course.section,
        primaryOfferedCourseId: course.primary_offered_course_id,
        isCooffered: Boolean(course.is_cooffered),
        linkedPrimaryLabel: course.primary_offered_course
          ? `${course.primary_offered_course.offerings.programs.short_name} | ${course.primary_offered_course.master_courses.course_code} Sec-${course.primary_offered_course.section}`
          : "",
        secondaryCount: course.secondary_offered_courses.length,
        batchCodes: course.offered_course_batches.map(
          (row) => row.batches.batch_code
        ),
        slotCount: course.offered_course_slots.length,
        teacherCount: course.offered_course_teachers.length,
        label: `${offering.programs.short_name} | ${course.master_courses.course_code} - ${course.master_courses.course_title} | Sec-${course.section} | ${offering.status}`,
      }))
    );

    const candidates: Array<{
      primaryId: number;
      secondaryId: number;
      primaryLabel: string;
      secondaryLabel: string;
      score: number;
      reason: string;
    }> = [];

    const unlinkedCourses = flatCourses.filter(
      (course) => !course.primaryOfferedCourseId
    );

    for (let i = 0; i < unlinkedCourses.length; i += 1) {
      for (let j = i + 1; j < unlinkedCourses.length; j += 1) {
        const a = unlinkedCourses[i];
        const b = unlinkedCourses[j];

        if (a.programCode === b.programCode) continue;

        const sameCredit = Math.abs(a.credit - b.credit) < 0.01;
        const exactTitle = a.courseTitleNorm === b.courseTitleNorm;
        const score = titleScore(a.courseTitle, b.courseTitle);

        if (!sameCredit) continue;

        if (exactTitle || score >= 0.45) {
          candidates.push({
            primaryId: a.id,
            secondaryId: b.id,
            primaryLabel: a.label,
            secondaryLabel: b.label,
            score: Number(score.toFixed(2)),
            reason: exactTitle
              ? "Exact title + same credit"
              : "Similar title + same credit",
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      termName,
      diagnostics: {
        matchedOfferings: offerings.map((offering) => ({
          offeringId: offering.id,
          programCode: offering.programs.short_name,
          programName: offering.programs.name,
          status: offering.status,
          courseCount: offering.offered_courses.length,
        })),
        totalCoursesScanned: flatCourses.length,
        totalCandidates: candidates.length,
      },
      courses: flatCourses,
      candidates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load co-offering decision data.",
      },
      { status: 500 }
    );
  }
}
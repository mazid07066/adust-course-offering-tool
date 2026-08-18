import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireFacultyApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type ProgramTallyRow = {
  programCode: string;
  theoryCredits: number;
  labCredits: number;
  totalCredits: number;
};

type ScheduleRow = {
  offeredCourseId: number;
  courseCode: string;
  coOfferedCourseCodes: string[];
  courseTitle: string;
  section: string;
  credit: number;
  category: "THEORY" | "LAB" | "PROJECT";
  dayOfWeek: string;
  timeText: string;
  roomText: string;
  batchCodes: string[];
};

function isLabCourse(title: string, courseType: string | null | undefined) {
  const t = String(title || "").toUpperCase();
  const ct = String(courseType || "").toUpperCase();
  return t.includes("LAB") || ct.includes("LAB");
}

function isProjectLikeCourse(title: string, courseType: string | null | undefined) {
  const t = String(title || "").toUpperCase();
  const ct = String(courseType || "").toUpperCase();
  return (
    t.includes("PROJECT") ||
    t.includes("INTERNSHIP") ||
    t.includes("THESIS") ||
    ct.includes("PROJECT")
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function GET(req: NextRequest) {
  const guard = await requireFacultyApi();
  if (guard instanceof Response) return guard;

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        { error: "Faculty account is not linked to a teacher record." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const termName = String(searchParams.get("termName") || "").trim().toUpperCase();

    if (!termName) {
      return NextResponse.json(
        { error: "termName is required." },
        { status: 400 }
      );
    }

    const [teacher, term] = await Promise.all([
      prisma.teachers.findUnique({
        where: { id: guard.teacher_id },
        include: {
          departments: true,
        },
      }),
      prisma.academic_terms.findFirst({
        where: { name: termName },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!teacher) {
      return NextResponse.json(
        { error: "Faculty record not found." },
        { status: 404 }
      );
    }

    if (!term) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 }
      );
    }

    const assignedRows = await prisma.offered_course_teachers.findMany({
      where: {
        teacher_id: teacher.id,
        offered_courses: {
          offerings: {
            academic_term_id: term.id,
          },
        },
      },
      include: {
        offered_courses: {
          include: {
            offerings: true,
            master_courses: {
              include: {
                program: true,
              },
            },
            offered_course_batches: {
              include: {
                batches: true,
              },
            },
            offered_course_slots: {
              include: {
                rooms: true,
              },
              orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
            },
          },
        },
      },
      orderBy: [{ id: "asc" }],
    });

    /*
     * Co-offered display metadata.
     *
     * Faculty assignments remain attached to the PRIMARY offered course.
     * This lookup only adds display codes for:
     *
     * 1. linked SECONDARY offered courses, and
     * 2. manually registered co-offer codes.
     *
     * No assignment, credit, room, slot, faculty-choice, or
     * primary/secondary business rule is changed here.
     */
    const assignedCourseIds = Array.from(
      new Set(
        assignedRows
          .map((row) => row.offered_course_id)
          .filter((id): id is number => Number.isInteger(id))
      )
    );

    const coOfferCodeRows =
      assignedCourseIds.length > 0
        ? await prisma.$queryRaw<
            Array<{
              primaryOfferedCourseId: number;
              courseCode: string;
            }>
          >(
            Prisma.sql`
              SELECT
                secondary.primary_offered_course_id
                  AS "primaryOfferedCourseId",
                mc.course_code
                  AS "courseCode"
              FROM offered_courses secondary
              INNER JOIN master_courses mc
                ON mc.id = secondary.master_course_id
              WHERE secondary.primary_offered_course_id
                IN (${Prisma.join(assignedCourseIds)})

              UNION

              SELECT
                manual.offered_course_id
                  AS "primaryOfferedCourseId",
                manual.manual_course_code
                  AS "courseCode"
              FROM offered_course_manual_cooffers manual
              WHERE manual.offered_course_id
                IN (${Prisma.join(assignedCourseIds)})
            `
          )
        : [];

    const coOfferCodesByPrimary =
      new Map<number, string[]>();

    for (const row of coOfferCodeRows) {
      const existing =
        coOfferCodesByPrimary.get(
          row.primaryOfferedCourseId
        ) || [];

      existing.push(row.courseCode);

      coOfferCodesByPrimary.set(
        row.primaryOfferedCourseId,
        uniqueStrings(existing)
      );
    }

    const mergedMap = new Map<
      string,
      {
        offeredCourseId: number;
        programCode: string;
        courseCode: string;
        coOfferedCourseCodes: string[];
        courseTitle: string;
        section: string;
        credit: number;
        category: "THEORY" | "LAB" | "PROJECT";
        batchCodes: string[];
        slots: Array<{
          dayOfWeek: string;
          timeText: string;
          roomText: string;
        }>;
      }
    >();

    for (const row of assignedRows) {
      const course = row.offered_courses;
      const master = course.master_courses;

      const coOfferedCourseCodes = uniqueStrings(
        coOfferCodesByPrimary.get(course.id) || []
      ).filter(
        (code) =>
          code.trim().toUpperCase() !==
          master.course_code.trim().toUpperCase()
      );

      const credit = Number(master.credit || 0);
      const category: "THEORY" | "LAB" | "PROJECT" = isProjectLikeCourse(
        master.course_title,
        master.course_type
      )
        ? "PROJECT"
        : isLabCourse(master.course_title, master.course_type)
        ? "LAB"
        : "THEORY";

      const signature = [
        master.program.short_name,
        master.course_code,
        course.section,
      ].join("::");

      const batchCodes = course.offered_course_batches.map((x) => x.batches.batch_code);
      const slots =
        course.offered_course_slots.length === 0
          ? [{ dayOfWeek: "-", timeText: "-", roomText: "-" }]
          : course.offered_course_slots.map((slot) => ({
              dayOfWeek: slot.day_of_week,
              timeText: `${slot.start_time} - ${slot.end_time}`,
              roomText: slot.rooms?.room_code || "-",
            }));

      if (!mergedMap.has(signature)) {
        mergedMap.set(signature, {
          offeredCourseId: course.id,
          programCode: master.program.short_name,
          courseCode: master.course_code,
          coOfferedCourseCodes,
          courseTitle: master.course_title,
          section: course.section,
          credit,
          category,
          batchCodes,
          slots,
        });
      } else {
        const current = mergedMap.get(signature)!;

        current.coOfferedCourseCodes = uniqueStrings([
          ...current.coOfferedCourseCodes,
          ...coOfferedCourseCodes,
        ]);

        current.batchCodes = uniqueStrings([...current.batchCodes, ...batchCodes]);

        const slotSignatureSet = new Set(
          current.slots.map((s) => `${s.dayOfWeek}::${s.timeText}::${s.roomText}`)
        );

        for (const slot of slots) {
          const key = `${slot.dayOfWeek}::${slot.timeText}::${slot.roomText}`;
          if (!slotSignatureSet.has(key)) {
            current.slots.push(slot);
            slotSignatureSet.add(key);
          }
        }
      }
    }

    let totalTheoryCredits = 0;
    let totalLabCredits = 0;
    const tallyMap = new Map<string, ProgramTallyRow>();
    const scheduleRows: ScheduleRow[] = [];

    for (const item of mergedMap.values()) {
      if (item.category === "LAB") totalLabCredits += item.credit;
      else totalTheoryCredits += item.credit;

      if (!tallyMap.has(item.programCode)) {
        tallyMap.set(item.programCode, {
          programCode: item.programCode,
          theoryCredits: 0,
          labCredits: 0,
          totalCredits: 0,
        });
      }

      const tally = tallyMap.get(item.programCode)!;
      if (item.category === "LAB") tally.labCredits += item.credit;
      else tally.theoryCredits += item.credit;
      tally.totalCredits += item.credit;

      for (const slot of item.slots) {
        scheduleRows.push({
          offeredCourseId: item.offeredCourseId,
          courseCode: item.courseCode,
          coOfferedCourseCodes: item.coOfferedCourseCodes,
          courseTitle: item.courseTitle,
          section: item.section,
          credit: item.credit,
          category: item.category,
          dayOfWeek: slot.dayOfWeek,
          timeText: slot.timeText,
          roomText: slot.roomText,
          batchCodes: uniqueStrings(item.batchCodes),
        });
      }
    }

    scheduleRows.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek.localeCompare(b.dayOfWeek);
      if (a.timeText !== b.timeText) return a.timeText.localeCompare(b.timeText);
      if (a.courseCode !== b.courseCode) return a.courseCode.localeCompare(b.courseCode);
      return a.section.localeCompare(b.section);
    });

    const programTallies = Array.from(tallyMap.values()).sort((a, b) =>
      a.programCode.localeCompare(b.programCode)
    );

    return NextResponse.json({
      success: true,
      faculty: {
        teacherId: teacher.id,
        departmentName: teacher.departments?.name || "-",
        departmentCode: teacher.departments?.short_name || "-",
        fullName: teacher.full_name,
        designation: teacher.designation || "-",
        initial: teacher.teacher_code,
      },
      termName: term.name,
      assignedAt: new Date().toISOString(),
      totals: {
        theoryCredits: totalTheoryCredits,
        labCredits: totalLabCredits,
        totalCredits: totalTheoryCredits + totalLabCredits,
      },
      programTallies,
      scheduleRows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load approved assigned schedule." },
      { status: 500 }
    );
  }
}
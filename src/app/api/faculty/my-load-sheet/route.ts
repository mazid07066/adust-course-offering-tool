import { NextRequest, NextResponse } from "next/server";
import { requireFacultyApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type ProgramTallyRow = {
  programCode: string;
  theoryCredits: number;
  labCredits: number;
  totalCredits: number;
};

type ScheduleRow = {
  courseCode: string;
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

    const selections = await prisma.faculty_course_selections.findMany({
      where: {
        teacher_id: teacher.id,
        academic_term_id: term.id,
        status: "FINAL",
      },
      include: {
        offered_courses: {
          include: {
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
      orderBy: [{ priority_order: "asc" }, { id: "asc" }],
    });

    const submissionAt =
      selections
        .map((row) => row.confirmed_at || row.selected_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b as Date).getTime() - new Date(a as Date).getTime())[0] ||
      null;

    let totalTheoryCredits = 0;
    let totalLabCredits = 0;

    const tallyMap = new Map<string, ProgramTallyRow>();
    const scheduleRows: ScheduleRow[] = [];

    for (const row of selections) {
      const course = row.offered_courses;
      const master = course.master_courses;

      const programCode = master.program.short_name;
      const credit = Number(master.credit || 0);

      const category: "THEORY" | "LAB" | "PROJECT" = isProjectLikeCourse(
        master.course_title,
        master.course_type
      )
        ? "PROJECT"
        : isLabCourse(master.course_title, master.course_type)
        ? "LAB"
        : "THEORY";

      if (category === "LAB") {
        totalLabCredits += credit;
      } else {
        totalTheoryCredits += credit;
      }

      if (!tallyMap.has(programCode)) {
        tallyMap.set(programCode, {
          programCode,
          theoryCredits: 0,
          labCredits: 0,
          totalCredits: 0,
        });
      }

      const tally = tallyMap.get(programCode)!;
      if (category === "LAB") {
        tally.labCredits += credit;
      } else {
        tally.theoryCredits += credit;
      }
      tally.totalCredits += credit;

      const batchCodes = uniqueStrings(
        course.offered_course_batches.map((x) => x.batches.batch_code)
      );

      if (course.offered_course_slots.length === 0) {
        scheduleRows.push({
          courseCode: master.course_code,
          courseTitle: master.course_title,
          section: course.section,
          credit,
          category,
          dayOfWeek: "-",
          timeText: "-",
          roomText: "-",
          batchCodes,
        });
      } else {
        for (const slot of course.offered_course_slots) {
          scheduleRows.push({
            courseCode: master.course_code,
            courseTitle: master.course_title,
            section: course.section,
            credit,
            category,
            dayOfWeek: slot.day_of_week,
            timeText: `${slot.start_time} - ${slot.end_time}`,
            roomText: slot.rooms?.room_code || "-",
            batchCodes,
          });
        }
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
      submittedAt: submissionAt ? new Date(submissionAt).toISOString() : null,
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
      { error: "Failed to load faculty load sheet." },
      { status: 500 }
    );
  }
}
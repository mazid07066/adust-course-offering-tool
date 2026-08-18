import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFacultyApi } from "@/lib/auth-guard";

const ALLOWED_NOTE_TYPES = [
  "CLASS_NOTE",
  "REMINDER",
  "ASSESSMENT",
  "PERSONAL",
] as const;

type PlannerNoteType = (typeof ALLOWED_NOTE_TYPES)[number];

type PlannerNoteRow = {
  id: number;
  teacher_id: number;
  academic_term_id: number;
  offered_course_id: number | null;
  note_date: string;
  note_type: string;
  title: string | null;
  note_text: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  course_code: string | null;
  course_title: string | null;
  section: string | null;
};

function normalizeNoteType(value: unknown): PlannerNoteType {
  const noteType = String(value || "CLASS_NOTE")
    .trim()
    .toUpperCase();

  if (!ALLOWED_NOTE_TYPES.includes(noteType as PlannerNoteType)) {
    throw new Error(
      `Invalid note type. Allowed values: ${ALLOWED_NOTE_TYPES.join(", ")}.`
    );
  }

  return noteType as PlannerNoteType;
}

function normalizeDate(value: unknown) {
  const raw = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("noteDate must use YYYY-MM-DD format.");
  }

  const parsed = new Date(`${raw}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid noteDate.");
  }

  return raw;
}

function normalizeMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error("month must use YYYY-MM format.");
  }

  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid month.");
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start: `${yearText}-${monthText}-01`,
    end: `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(
      2,
      "0"
    )}-01`,
  };
}

async function validateCourseAccess(input: {
  teacherId: number;
  academicTermId: number;
  offeredCourseId: number;
}) {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT oc.id
    FROM offered_courses oc
    JOIN offerings o
      ON o.id = oc.offering_id
    WHERE oc.id = ${input.offeredCourseId}
      AND o.academic_term_id = ${input.academicTermId}
      AND (
        EXISTS (
          SELECT 1
          FROM offered_course_teachers oct
          WHERE oct.offered_course_id = oc.id
            AND oct.teacher_id = ${input.teacherId}
        )
        OR EXISTS (
          SELECT 1
          FROM offered_courses secondary
          JOIN offered_course_teachers oct
            ON oct.offered_course_id = secondary.primary_offered_course_id
          WHERE secondary.id = oc.id
            AND oct.teacher_id = ${input.teacherId}
        )
      )
    LIMIT 1;
  `;

  return rows.length > 0;
}

export async function GET(req: NextRequest) {
  const guard = await requireFacultyApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        {
          error: "Faculty account is not linked to a teacher record.",
        },
        {
          status: 400,
        }
      );
    }

    const { searchParams } = new URL(req.url);

    const termName = String(searchParams.get("termName") || "")
      .trim()
      .toUpperCase();

    const month = String(searchParams.get("month") || "").trim();

    if (!termName) {
      return NextResponse.json(
        {
          error: "termName is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!month) {
      return NextResponse.json(
        {
          error: "month is required.",
        },
        {
          status: 400,
        }
      );
    }

    const range = normalizeMonth(month);

    const termRows = await prisma.$queryRaw<
      Array<{
        id: number;
        name: string;
      }>
    >`
      SELECT id, name
      FROM academic_terms
      WHERE UPPER(name) = ${termName}
      LIMIT 1;
    `;

    const term = termRows[0];

    if (!term) {
      return NextResponse.json(
        {
          error: "Academic term not found.",
        },
        {
          status: 404,
        }
      );
    }

    const notes = await prisma.$queryRaw<PlannerNoteRow[]>`
      SELECT
        n.id,
        n.teacher_id,
        n.academic_term_id,
        n.offered_course_id,
        n.note_date::text AS note_date,
        n.note_type,
        n.title,
        n.note_text,
        n.is_completed,
        n.created_at::text AS created_at,
        n.updated_at::text AS updated_at,
        mc.course_code,
        mc.course_title,
        oc.section
      FROM faculty_teaching_notes n
      LEFT JOIN offered_courses oc
        ON oc.id = n.offered_course_id
      LEFT JOIN master_courses mc
        ON mc.id = oc.master_course_id
      WHERE n.teacher_id = ${guard.teacher_id}
        AND n.academic_term_id = ${term.id}
        AND n.note_date >= ${range.start}::date
        AND n.note_date < ${range.end}::date
      ORDER BY
        n.note_date ASC,
        n.created_at ASC;
    `;

    return NextResponse.json({
      success: true,
      academicTerm: {
        id: term.id,
        name: term.name,
      },
      month,
      notes,
    });
  } catch (error) {
    console.error("Faculty planner GET failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load faculty teaching planner.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireFacultyApi();

  if (guard instanceof Response) {
    return guard;
  }

  try {
    if (!guard.teacher_id) {
      return NextResponse.json(
        {
          error: "Faculty account is not linked to a teacher record.",
        },
        {
          status: 400,
        }
      );
    }

    const body = await req.json();

    const academicTermId = Number(body.academicTermId);
    const offeredCourseId =
      body.offeredCourseId === null ||
      body.offeredCourseId === undefined ||
      body.offeredCourseId === ""
        ? null
        : Number(body.offeredCourseId);

    const noteDate = normalizeDate(body.noteDate);
    const noteType = normalizeNoteType(body.noteType);

    const title = String(body.title || "").trim();
    const noteText = String(body.noteText || "").trim();

    if (!Number.isInteger(academicTermId) || academicTermId <= 0) {
      return NextResponse.json(
        {
          error: "academicTermId must be a positive integer.",
        },
        {
          status: 400,
        }
      );
    }

    if (!noteText) {
      return NextResponse.json(
        {
          error: "Note text is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        {
          error: "Title must be 200 characters or fewer.",
        },
        {
          status: 400,
        }
      );
    }

    const termRows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM academic_terms
      WHERE id = ${academicTermId}
      LIMIT 1;
    `;

    if (termRows.length === 0) {
      return NextResponse.json(
        {
          error: "Academic term not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (offeredCourseId !== null) {
      if (!Number.isInteger(offeredCourseId) || offeredCourseId <= 0) {
        return NextResponse.json(
          {
            error: "offeredCourseId must be a positive integer.",
          },
          {
            status: 400,
          }
        );
      }

      const allowed = await validateCourseAccess({
        teacherId: guard.teacher_id,
        academicTermId,
        offeredCourseId,
      });

      if (!allowed) {
        return NextResponse.json(
          {
            error:
              "You can only attach planner notes to courses assigned to you.",
          },
          {
            status: 403,
          }
        );
      }
    }

    const rows = await prisma.$queryRaw<PlannerNoteRow[]>`
      INSERT INTO faculty_teaching_notes (
        teacher_id,
        academic_term_id,
        offered_course_id,
        note_date,
        note_type,
        title,
        note_text,
        is_completed,
        created_at,
        updated_at
      )
      VALUES (
        ${guard.teacher_id},
        ${academicTermId},
        ${offeredCourseId},
        ${noteDate}::date,
        ${noteType},
        ${title || null},
        ${noteText},
        FALSE,
        NOW(),
        NOW()
      )
      RETURNING
        id,
        teacher_id,
        academic_term_id,
        offered_course_id,
        note_date::text AS note_date,
        note_type,
        title,
        note_text,
        is_completed,
        created_at::text AS created_at,
        updated_at::text AS updated_at,
        NULL::text AS course_code,
        NULL::text AS course_title,
        NULL::text AS section;
    `;

    return NextResponse.json({
      success: true,
      note: rows[0],
    });
  } catch (error) {
    console.error("Faculty planner POST failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save faculty planner note.",
      },
      {
        status: 500,
      }
    );
  }
}

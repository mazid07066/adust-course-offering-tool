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

export async function PATCH(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
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

    const { id } = await context.params;
    const noteId = Number(id);

    if (!Number.isInteger(noteId) || noteId <= 0) {
      return NextResponse.json(
        {
          error: "Invalid planner note id.",
        },
        {
          status: 400,
        }
      );
    }

    const existingRows = await prisma.$queryRaw<
      Array<{
        id: number;
        academic_term_id: number;
        offered_course_id: number | null;
        note_date: string;
        note_type: string;
        title: string | null;
        note_text: string;
        is_completed: boolean;
      }>
    >`
      SELECT
        id,
        academic_term_id,
        offered_course_id,
        note_date::text AS note_date,
        note_type,
        title,
        note_text,
        is_completed
      FROM faculty_teaching_notes
      WHERE id = ${noteId}
        AND teacher_id = ${guard.teacher_id}
      LIMIT 1;
    `;

    const existing = existingRows[0];

    if (!existing) {
      return NextResponse.json(
        {
          error: "Planner note not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body = await req.json();

    const noteDate =
      body.noteDate === undefined
        ? existing.note_date
        : normalizeDate(body.noteDate);

    const noteType =
      body.noteType === undefined
        ? normalizeNoteType(existing.note_type)
        : normalizeNoteType(body.noteType);

    const title =
      body.title === undefined
        ? existing.title
        : String(body.title || "").trim() || null;

    const noteText =
      body.noteText === undefined
        ? existing.note_text
        : String(body.noteText || "").trim();

    const isCompleted =
      body.isCompleted === undefined
        ? existing.is_completed
        : Boolean(body.isCompleted);

    const offeredCourseId =
      body.offeredCourseId === undefined
        ? existing.offered_course_id
        : body.offeredCourseId === null ||
            body.offeredCourseId === ""
          ? null
          : Number(body.offeredCourseId);

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

    if (title && title.length > 200) {
      return NextResponse.json(
        {
          error: "Title must be 200 characters or fewer.",
        },
        {
          status: 400,
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
        academicTermId: existing.academic_term_id,
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

    await prisma.$executeRaw`
      UPDATE faculty_teaching_notes
      SET
        offered_course_id = ${offeredCourseId},
        note_date = ${noteDate}::date,
        note_type = ${noteType},
        title = ${title},
        note_text = ${noteText},
        is_completed = ${isCompleted},
        updated_at = NOW()
      WHERE id = ${noteId}
        AND teacher_id = ${guard.teacher_id};
    `;

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Faculty planner PATCH failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update faculty planner note.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
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

    const { id } = await context.params;
    const noteId = Number(id);

    if (!Number.isInteger(noteId) || noteId <= 0) {
      return NextResponse.json(
        {
          error: "Invalid planner note id.",
        },
        {
          status: 400,
        }
      );
    }

    const deleted = await prisma.$executeRaw`
      DELETE FROM faculty_teaching_notes
      WHERE id = ${noteId}
        AND teacher_id = ${guard.teacher_id};
    `;

    if (deleted === 0) {
      return NextResponse.json(
        {
          error: "Planner note not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Faculty planner DELETE failed:", error);

    return NextResponse.json(
      {
        error: "Failed to delete faculty planner note.",
      },
      {
        status: 500,
      }
    );
  }
}

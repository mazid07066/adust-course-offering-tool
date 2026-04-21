import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  canTransitionOfferingStatus,
  OFFERING_STATUS,
} from "@/lib/offering-status";

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function isSlotOptionalCourse(course: {
  master_courses: {
    course_title?: string | null;
    course_type?: string | null;
  };
}) {
  const title = normalizeText(course.master_courses.course_title);
  const type = normalizeText(course.master_courses.course_type);

  if (
    type.includes("PROJECT") ||
    type.includes("INTERNSHIP") ||
    type.includes("THESIS") ||
    type.includes("VIVA")
  ) {
    return true;
  }

  if (
    title.includes("FINAL YEAR DESIGN PROJECT") ||
    title.includes("FYDP") ||
    title.includes("INTERNSHIP") ||
    title.includes("THESIS") ||
    title.includes("VIVA")
  ) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await request.json();
    const offeringId = Number(body?.offeringId);
    const targetStatus = normalizeText(body?.targetStatus);

    if (!offeringId) {
      return NextResponse.json(
        { ok: false, error: "Valid offeringId is required." },
        { status: 400 }
      );
    }

    if (!targetStatus) {
      return NextResponse.json(
        { ok: false, error: "targetStatus is required." },
        { status: 400 }
      );
    }

    const offering = await prisma.offerings.findFirst({
      where: { id: offeringId },
      include: {
        offered_courses: {
          include: {
            master_courses: true,
            offered_course_batches: true,
            offered_course_slots: true,
            offered_course_teachers: {
              include: {
                teachers: true,
              },
            },
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json(
        { ok: false, error: "Offering not found." },
        { status: 404 }
      );
    }

    if (!canTransitionOfferingStatus(offering.status, targetStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid lifecycle transition from ${offering.status} to ${targetStatus}.`,
        },
        { status: 400 }
      );
    }

    const blockers: string[] = [];

    if (targetStatus === OFFERING_STATUS.BUFFER_READY) {
      if (offering.offered_courses.length === 0) {
        blockers.push("Cannot move empty offering to BUFFER_READY.");
      }

      for (const course of offering.offered_courses) {
        const isPrimary = !course.primary_offered_course_id;
        const slotOptional = isSlotOptionalCourse(course);

        if (course.offered_course_batches.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no batch assigned.`
          );
        }

        if (!isPrimary) {
          continue;
        }

        if (!slotOptional && course.offered_course_slots.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no meeting slot assigned.`
          );
        }
      }
    }

    if (targetStatus === OFFERING_STATUS.CONFIRMED) {
      for (const course of offering.offered_courses) {
        const isPrimary = !course.primary_offered_course_id;
        const slotOptional = isSlotOptionalCourse(course);

        if (course.offered_course_batches.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no batch assigned.`
          );
        }

        if (!isPrimary) {
          continue;
        }

        if (!slotOptional && course.offered_course_slots.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no meeting slot assigned.`
          );
        }

        if (course.offered_course_teachers.length === 0) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: no faculty assigned.`
          );
        }

        if (course.offered_course_teachers.length > 1) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: multiple faculty assignments found.`
          );
        }

        const inactiveAssignedTeacher = course.offered_course_teachers.find(
          (row) => !row.teachers.is_active
        );

        if (inactiveAssignedTeacher) {
          blockers.push(
            `${course.master_courses.course_code} Sec-${course.section}: assigned faculty is inactive.`
          );
        }
      }
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Transition to ${targetStatus} blocked.`,
          blockers,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.offerings.update({
      where: { id: offeringId },
      data: { status: targetStatus },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Offering moved to ${updated.status}.`,
      offering: updated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to change offering status.",
      },
      { status: 500 }
    );
  }
}
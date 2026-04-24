export type DraftSlotView = {
  id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_id: number;
  slot_type: string | null;
  rooms: {
    room_code: string;
    room_type: string | null;
  } | null;
};

export type DraftManualCoofferView = {
  id: number;
  target_program_code: string | null;
  manual_course_code: string;
  note: string | null;
};

export type DraftCourseForGrouping = {
  id: number;
  section: string;
  is_cooffered: boolean | null;
  primary_offered_course_id: number | null;
  master_courses: {
    course_code: string;
    course_title: string;
    program: {
      short_name: string;
      name: string;
    };
  };
  offered_course_batches: Array<{
    batch_id: number;
    batches: {
      batch_code: string;
    };
  }>;
  offered_course_teachers: Array<{
    teacher_id: number;
    teachers: {
      teacher_code: string;
      full_name: string;
    } | null;
  }>;
  offered_course_slots: DraftSlotView[];
  offered_course_manual_cooffers?: DraftManualCoofferView[];
};

function formatRoomLabel(room: { room_code: string; room_type: string | null } | null) {
  if (!room) return "-";
  return room.room_type ? `${room.room_type} | ${room.room_code}` : room.room_code;
}

export function buildDraftSectionGroups(courses: DraftCourseForGrouping[]) {
  const primaryCourses = courses.filter((course) => !course.primary_offered_course_id);

  return primaryCourses.map((primary) => {
    const linkedCourses = courses.filter(
      (course) => course.primary_offered_course_id === primary.id
    );

    const allCoursesInGroup = [primary, ...linkedCourses];

    const sectionBatchCodes = [
      ...new Set(
        allCoursesInGroup.flatMap((course) =>
          course.offered_course_batches.map((x) => x.batches.batch_code)
        )
      ),
    ];

    return {
      primary_course: {
        id: primary.id,
        section: primary.section,
        is_cooffered: Boolean(primary.is_cooffered),
        master_course: {
          course_code: primary.master_courses.course_code,
          course_title: primary.master_courses.course_title,
          program_code: primary.master_courses.program.short_name,
          program_name: primary.master_courses.program.name,
        },
        offered_course_batches: primary.offered_course_batches.map((x) => ({
          batch_id: x.batch_id,
          batches: {
            batch_code: x.batches.batch_code,
          },
        })),
        offered_course_teachers: primary.offered_course_teachers.map((x) => ({
          teacher_id: x.teacher_id,
          teachers: x.teachers
            ? {
                teacher_code: x.teachers.teacher_code,
                full_name: x.teachers.full_name,
              }
            : null,
        })),
        offered_course_slots: primary.offered_course_slots.map((slot) => ({
          ...slot,
          schedule_label: `${slot.day_of_week} ${slot.start_time}-${slot.end_time} | ${formatRoomLabel(slot.rooms)}`,
        })),
        offered_course_manual_cooffers: (primary.offered_course_manual_cooffers || []).map(
          (item) => ({
            id: item.id,
            target_program_code: item.target_program_code,
            manual_course_code: item.manual_course_code,
            note: item.note,
          })
        ),
        schedule_text:
          primary.offered_course_slots.length > 0
            ? primary.offered_course_slots
                .map(
                  (slot) =>
                    `${slot.day_of_week} ${slot.start_time}-${slot.end_time} | ${formatRoomLabel(
                      slot.rooms
                    )}`
                )
                .join(" || ")
            : "-",
      },
      linked_courses: linkedCourses.map((course) => ({
        id: course.id,
        section: course.section,
        master_course: {
          course_code: course.master_courses.course_code,
          course_title: course.master_courses.course_title,
          program_code: course.master_courses.program.short_name,
          program_name: course.master_courses.program.name,
        },
        offered_course_batches: course.offered_course_batches.map((x) => ({
          batch_id: x.batch_id,
          batches: {
            batch_code: x.batches.batch_code,
          },
        })),
      })),
      section_batch_codes: sectionBatchCodes,
    };
  });
}

type MinimalTx = any;

export async function deleteOfferedCourseCascade(
  tx: MinimalTx,
  offeredCourseId: number
) {
  const root = await tx.offered_courses.findUnique({
    where: { id: offeredCourseId },
    select: {
      id: true,
      primary_offered_course_id: true,

      secondary_offered_courses: {
        select: { id: true },
      },
    },
  });

  if (!root) return;

  const targetIds =
    root.primary_offered_course_id == null
      ? [
          root.id,
          ...root.secondary_offered_courses.map((x: { id: number }) => x.id),
        ]
      : [root.id];

  if (targetIds.length === 0) return;

  if (tx.offered_course_manual_cooffers) {
    await tx.offered_course_manual_cooffers.deleteMany({
      where: {
        offered_course_id: { in: targetIds },
      },
    });
  }

  await tx.faculty_course_selections.deleteMany({
    where: {
      offered_course_id: { in: targetIds },
    },
  });

  await tx.offered_course_teachers.deleteMany({
    where: {
      offered_course_id: { in: targetIds },
    },
  });

  await tx.offered_course_slots.deleteMany({
    where: {
      offered_course_id: { in: targetIds },
    },
  });

  await tx.offered_course_batches.deleteMany({
    where: {
      offered_course_id: { in: targetIds },
    },
  });

  await tx.offered_courses.deleteMany({
    where: {
      id: { in: targetIds },
    },
  });
}
export async function getSectionGroupCourseIds(
  tx: any,
  offeredCourseId: number
): Promise<number[]> {
  const course = await tx.offered_courses.findUnique({
    where: { id: offeredCourseId },
    select: {
      id: true,
      primary_offered_course_id: true,
      secondary_offered_courses: {
        select: { id: true },
      },
    },
  });

  if (!course) return [];

  const primaryId = course.primary_offered_course_id ?? course.id;

  const primary = await tx.offered_courses.findUnique({
    where: { id: primaryId },
    select: {
      id: true,
      secondary_offered_courses: {
        select: { id: true },
      },
    },
  });

  if (!primary) return [offeredCourseId];

  return [
    primary.id,
    ...primary.secondary_offered_courses.map((item: { id: number }) => item.id),
  ];
}

export async function getSectionGroupBatchIds(
  tx: any,
  offeredCourseId: number
): Promise<number[]> {
  const courseIds = await getSectionGroupCourseIds(tx, offeredCourseId);

  if (courseIds.length === 0) return [];

  const rows = await tx.offered_course_batches.findMany({
    where: {
      offered_course_id: {
        in: courseIds,
      },
    },
    select: {
      batch_id: true,
    },
  });

  return Array.from(
    new Set(
      rows
        .map((row: { batch_id: number }) => row.batch_id)
        .filter((id: number) => Number.isFinite(id))
    )
  );
}
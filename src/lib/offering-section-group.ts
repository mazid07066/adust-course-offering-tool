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
          id: slot.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          room_id: slot.room_id,
          slot_type: slot.slot_type,
          rooms: slot.rooms
            ? {
                room_code: slot.rooms.room_code,
                room_type: slot.rooms.room_type,
              }
            : null,
        })),
        schedule_text:
          primary.offered_course_slots.length > 0
            ? primary.offered_course_slots
                .map(
                  (slot) =>
                    `${slot.day_of_week} ${slot.start_time}-${slot.end_time} (${formatRoomLabel(
                      slot.rooms
                    )})`
                )
                .join(" | ")
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
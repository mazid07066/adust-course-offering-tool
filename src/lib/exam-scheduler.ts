export type ExamCourseInput = {
  offeredCourseId: number | null;
  programId: number | null;
  programCode: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  batchCodes: string[];
  studentCount: number;
};

export type ExamRoomInput = {
  id: number;
  roomCode: string;
  capacity: number;
};

export type ExamSlotInput = {
  startTime: string;
  endTime: string;
};

export type GeneratedExamItem = ExamCourseInput & {
  examDate: string;
  startTime: string;
  endTime: string;
  roomId: number;
  roomCode: string;
  roomCapacity: number;
  seatPlanNote: string;
};

export type ExamScheduleGenerationResult = {
  success: boolean;
  items: GeneratedExamItem[];
  unscheduled: Array<{
    courseCode: string;
    section: string;
    batchCodes: string[];
    reason: string;
  }>;
  warnings: string[];
};

function normalizeTimeText(value: string) {
  return String(value || "").trim();
}

export function minutesFromTime(value: string) {
  const text = normalizeTimeText(value).toUpperCase();

  const amPmMatch = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (amPmMatch) {
    let hour = Number(amPmMatch[1]);
    const minute = Number(amPmMatch[2] || 0);
    const marker = amPmMatch[3];

    if (marker === "AM" && hour === 12) hour = 0;
    if (marker === "PM" && hour !== 12) hour += 12;

    return hour * 60 + minute;
  }

  const standardMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (standardMatch) {
    return Number(standardMatch[1]) * 60 + Number(standardMatch[2]);
  }

  const hourOnlyMatch = text.match(/^(\d{1,2})$/);
  if (hourOnlyMatch) {
    return Number(hourOnlyMatch[1]) * 60;
  }

  throw new Error(`Invalid time format: ${value}`);
}

export function addMinutesToTime(startTime: string, durationMinutes: number) {
  const total = minutesFromTime(startTime) + durationMinutes;
  const hour = Math.floor(total / 60);
  const minute = total % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function slotsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  const a1 = minutesFromTime(startA);
  const a2 = minutesFromTime(endA);
  const b1 = minutesFromTime(startB);
  const b2 = minutesFromTime(endB);

  return a1 < b2 && b1 < a2;
}

function batchKey(date: string, batchCode: string) {
  return `${date}::${batchCode}`;
}

function slotKey(date: string, startTime: string, endTime: string) {
  return `${date}::${startTime}::${endTime}`;
}

function roomSlotKey(
  date: string,
  startTime: string,
  endTime: string,
  roomId: number
) {
  return `${date}::${startTime}::${endTime}::${roomId}`;
}

export function generateExamSchedule(input: {
  courses: ExamCourseInput[];
  dates: string[];
  slots: ExamSlotInput[];
  rooms: ExamRoomInput[];
  maxExamsPerBatchPerDay: number;
}): ExamScheduleGenerationResult {
  const warnings: string[] = [];
  const unscheduled: ExamScheduleGenerationResult["unscheduled"] = [];
  const items: GeneratedExamItem[] = [];

  const maxPerDay = Math.max(1, Number(input.maxExamsPerBatchPerDay || 1));

  const dates = input.dates
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const slots = input.slots
    .map((slot) => ({
      startTime: normalizeTimeText(slot.startTime),
      endTime: normalizeTimeText(slot.endTime),
    }))
    .filter((slot) => slot.startTime && slot.endTime);

  const rooms = [...input.rooms]
    .filter((room) => room.id && room.capacity > 0)
    .sort((a, b) => a.capacity - b.capacity);

  const courses = [...input.courses]
    .filter((course) => course.courseCode && course.section)
    .sort((a, b) => {
      if (b.studentCount !== a.studentCount) {
        return b.studentCount - a.studentCount;
      }

      return `${a.courseCode}-${a.section}`.localeCompare(
        `${b.courseCode}-${b.section}`
      );
    });

  if (dates.length === 0) {
    return {
      success: false,
      items: [],
      unscheduled: courses.map((course) => ({
        courseCode: course.courseCode,
        section: course.section,
        batchCodes: course.batchCodes,
        reason: "No exam dates were provided.",
      })),
      warnings,
    };
  }

  if (slots.length === 0) {
    return {
      success: false,
      items: [],
      unscheduled: courses.map((course) => ({
        courseCode: course.courseCode,
        section: course.section,
        batchCodes: course.batchCodes,
        reason: "No exam slots were provided.",
      })),
      warnings,
    };
  }

  if (rooms.length === 0) {
    return {
      success: false,
      items: [],
      unscheduled: courses.map((course) => ({
        courseCode: course.courseCode,
        section: course.section,
        batchCodes: course.batchCodes,
        reason: "No rooms with capacity were provided.",
      })),
      warnings,
    };
  }

  const batchDailyCount = new Map<string, number>();
  const batchSlotUse = new Set<string>();
  const roomSlotUse = new Set<string>();

  for (const course of courses) {
    const requiredSeats = Number(course.studentCount || 0);

    if (requiredSeats <= 0) {
      unscheduled.push({
        courseCode: course.courseCode,
        section: course.section,
        batchCodes: course.batchCodes,
        reason: "Student count must be greater than zero.",
      });
      continue;
    }

    const candidateRooms = rooms.filter((room) => room.capacity >= requiredSeats);

    if (candidateRooms.length === 0) {
      unscheduled.push({
        courseCode: course.courseCode,
        section: course.section,
        batchCodes: course.batchCodes,
        reason: `No selected room has enough capacity for ${requiredSeats} students.`,
      });
      continue;
    }

    let placed = false;

    dateLoop: for (const date of dates) {
      const batchLimitOk = course.batchCodes.every((batchCode) => {
        const key = batchKey(date, batchCode);
        return (batchDailyCount.get(key) || 0) < maxPerDay;
      });

      if (!batchLimitOk) {
        continue;
      }

      for (const slot of slots) {
        const currentSlotKey = slotKey(date, slot.startTime, slot.endTime);

        const batchSlotOk = course.batchCodes.every(
          (batchCode) => !batchSlotUse.has(`${currentSlotKey}::${batchCode}`)
        );

        if (!batchSlotOk) {
          continue;
        }

        for (const room of candidateRooms) {
          const rKey = roomSlotKey(
            date,
            slot.startTime,
            slot.endTime,
            room.id
          );

          if (roomSlotUse.has(rKey)) {
            continue;
          }

          items.push({
            ...course,
            examDate: date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            roomId: room.id,
            roomCode: room.roomCode,
            roomCapacity: room.capacity,
            seatPlanNote: "",
          });

          roomSlotUse.add(rKey);

          for (const batchCode of course.batchCodes) {
            batchSlotUse.add(`${currentSlotKey}::${batchCode}`);

            const dailyKey = batchKey(date, batchCode);
            batchDailyCount.set(dailyKey, (batchDailyCount.get(dailyKey) || 0) + 1);
          }

          placed = true;
          break dateLoop;
        }
      }
    }

    if (!placed) {
      unscheduled.push({
        courseCode: course.courseCode,
        section: course.section,
        batchCodes: course.batchCodes,
        reason:
          "Could not place this exam without violating batch/day limit, batch slot overlap, room capacity, or room slot conflict.",
      });
    }
  }

  if (unscheduled.length > 0) {
    warnings.push(
      `${unscheduled.length} course-section(s) could not be scheduled. Add more dates, slots, or rooms, or increase daily batch exam limit.`
    );
  }

  return {
    success: unscheduled.length === 0,
    items,
    unscheduled,
    warnings,
  };
}

export function validateExamItemMove(input: {
  movingItemId: number;
  items: Array<{
    id: number;
    batchCodes: string[];
    examDate: string;
    startTime: string;
    endTime: string;
    roomId: number | null;
  }>;
  next: {
    batchCodes: string[];
    examDate: string;
    startTime: string;
    endTime: string;
    roomId: number | null;
  };
  maxExamsPerBatchPerDay: number;
}) {
  const maxPerDay = Math.max(1, Number(input.maxExamsPerBatchPerDay || 1));

  const otherItems = input.items.filter((item) => item.id !== input.movingItemId);

  if (input.next.roomId) {
    const roomConflict = otherItems.find(
      (item) =>
        item.roomId === input.next.roomId &&
        item.examDate === input.next.examDate &&
        slotsOverlap(
          item.startTime,
          item.endTime,
          input.next.startTime,
          input.next.endTime
        )
    );

    if (roomConflict) {
      return {
        valid: false,
        error: "Selected room is already used in an overlapping exam slot.",
      };
    }
  }

  for (const batchCode of input.next.batchCodes) {
    const sameDayBatchItems = otherItems.filter(
      (item) =>
        item.examDate === input.next.examDate &&
        item.batchCodes.includes(batchCode)
    );

    if (sameDayBatchItems.length >= maxPerDay) {
      return {
        valid: false,
        error: `Batch ${batchCode} already reached the maximum ${maxPerDay} exam(s) for this day.`,
      };
    }

    const sameSlotBatchConflict = sameDayBatchItems.find((item) =>
      slotsOverlap(
        item.startTime,
        item.endTime,
        input.next.startTime,
        input.next.endTime
      )
    );

    if (sameSlotBatchConflict) {
      return {
        valid: false,
        error: `Batch ${batchCode} already has an exam in this time slot.`,
      };
    }
  }

  return {
    valid: true,
    error: "",
  };
}
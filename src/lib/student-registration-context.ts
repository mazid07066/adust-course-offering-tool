import { prisma } from "@/lib/prisma";
import { findCanonicalProgram } from "@/lib/canonical-program";

export const STUDENT_REGISTRATION_CONTEXT_STATUS = {
  READY: "READY",
  CLOSED: "CLOSED",
  BLOCKED: "BLOCKED",
} as const;

export type StudentRegistrationContextStatus =
  (typeof STUDENT_REGISTRATION_CONTEXT_STATUS)[keyof typeof STUDENT_REGISTRATION_CONTEXT_STATUS];

export const STUDENT_REGISTRATION_CONTEXT_REASON = {
  READY: "READY",

  STUDENT_NOT_FOUND:
    "STUDENT_NOT_FOUND",

  STUDENT_NOT_ACTIVE:
    "STUDENT_NOT_ACTIVE",

  NO_ACTIVE_ENROLLMENT:
    "NO_ACTIVE_ENROLLMENT",

  AMBIGUOUS_ACTIVE_ENROLLMENT:
    "AMBIGUOUS_ACTIVE_ENROLLMENT",

  ENROLLMENT_HAS_NO_BATCH:
    "ENROLLMENT_HAS_NO_BATCH",

  PROGRAM_IDENTITY_NOT_FOUND:
    "PROGRAM_IDENTITY_NOT_FOUND",

  CANONICAL_PROGRAM_NOT_FOUND:
    "CANONICAL_PROGRAM_NOT_FOUND",

  CANONICAL_BATCH_NOT_FOUND:
    "CANONICAL_BATCH_NOT_FOUND",

  NO_CURRENT_TERM:
    "NO_CURRENT_TERM",

  MULTIPLE_CURRENT_TERMS:
    "MULTIPLE_CURRENT_TERMS",

  NO_CONFIRMED_OFFERING:
    "NO_CONFIRMED_OFFERING",

  NO_BATCH_LINKED_COURSES:
    "NO_BATCH_LINKED_COURSES",
} as const;

export type StudentRegistrationContextReason =
  (typeof STUDENT_REGISTRATION_CONTEXT_REASON)[keyof typeof STUDENT_REGISTRATION_CONTEXT_REASON];

type RegistrationStudent = {
  id: number;
  studentId: string;
  fullName: string;
  status: string;
};

type RegistrationEnrollment = {
  id: number;
  operationalProgramId: number;
  operationalProgramCode: string;
  operationalProgramName: string;
  operationalBatchId: number;
  batchCode: string;
  curriculumKey: string | null;
  admissionSemester: string | null;
};

type RegistrationCanonicalProgram = {
  id: number;
  shortName: string;
  name: string;
};

type RegistrationCanonicalBatch = {
  id: number;
  batchCode: string;
  admissionTerm: string | null;
};

type RegistrationAcademicTerm = {
  id: number;
  name: string;
  year: number;
  termType: string;
};

export type StudentRegistrationEligibleCourse = {
  offeredCourseId: number;
  offeringId: number;
  offeringStatus: string;

  masterCourseId: number;
  courseCode: string;
  courseTitle: string;
  credit: number;
  courseType: string;
  levelTerm: string | null;
  curriculumKey: string | null;

  section: string;
  isCooffered: boolean;

  batchLinkId: number;

  teachers: Array<{
    teacherId: number;
    teacherCode: string;
    fullName: string;
    designation: string | null;
    assignedCredit: number;
    loadType: string;
  }>;

  slots: Array<{
    slotId: number;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    slotType: string;
    roomId: number;
    roomCode: string;
    roomType: string;
    roomCapacity: number | null;
  }>;
};

export type StudentRegistrationContext = {
  status: StudentRegistrationContextStatus;
  reason: StudentRegistrationContextReason;
  message: string;

  student: RegistrationStudent | null;
  enrollment: RegistrationEnrollment | null;

  canonicalProgram: RegistrationCanonicalProgram | null;
  canonicalBatch: RegistrationCanonicalBatch | null;

  academicTerm: RegistrationAcademicTerm | null;

  confirmedOfferingIds: number[];

  eligibleCourses: StudentRegistrationEligibleCourse[];

  diagnostics: {
    activeEnrollmentCount: number;
    currentTermCount: number;
    confirmedOfferingCount: number;
    eligibleCourseCount: number;

    programIdentitySource:
      | "CURRICULUM_KEY"
      | "OPERATIONAL_PROGRAM_CODE"
      | null;
  };
};

function normalizeText(
  value: string | null | undefined
) {
  return String(
    value ?? ""
  ).trim();
}

function normalizeUpper(
  value: string | null | undefined
) {
  return normalizeText(
    value
  ).toUpperCase();
}

function createBaseContext(
  overrides: Partial<StudentRegistrationContext> = {}
): StudentRegistrationContext {
  return {
    status:
      STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

    reason:
      STUDENT_REGISTRATION_CONTEXT_REASON.STUDENT_NOT_FOUND,

    message:
      "Student registration context is unavailable.",

    student:
      null,

    enrollment:
      null,

    canonicalProgram:
      null,

    canonicalBatch:
      null,

    academicTerm:
      null,

    confirmedOfferingIds:
      [],

    eligibleCourses:
      [],

    diagnostics: {
      activeEnrollmentCount:
        0,

      currentTermCount:
        0,

      confirmedOfferingCount:
        0,

      eligibleCourseCount:
        0,

      programIdentitySource:
        null,
    },

    ...overrides,
  };
}

export async function getStudentRegistrationContext(
  studentDbId: number
): Promise<StudentRegistrationContext> {
  if (
    !Number.isInteger(
      studentDbId
    ) ||
    studentDbId <= 0
  ) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.STUDENT_NOT_FOUND,

      message:
        "Invalid student identity.",
    });
  }

  /*
   * ----------------------------------------------------------
   * 1. Student and ACTIVE enrollment identity.
   * ----------------------------------------------------------
   */

  const student =
    await prisma.students.findUnique({
      where: {
        id:
          studentDbId,
      },

      select: {
        id:
          true,

        student_id:
          true,

        full_name:
          true,

        current_status:
          true,

        enrollments: {
          where: {
            enrollment_status:
              "ACTIVE",
          },

          select: {
            id:
              true,

            program_id:
              true,

            batch_id:
              true,

            curriculum_key:
              true,

            admission_semester:
              true,

            program: {
              select: {
                id:
                  true,

                short_name:
                  true,

                name:
                  true,

                departments: {
                  select: {
                    short_name:
                      true,

                    name:
                      true,
                  },
                },
              },
            },

            batches: {
              select: {
                id:
                  true,

                batch_code:
                  true,

                admission_term:
                  true,

                program_id:
                  true,

                is_active:
                  true,
              },
            },
          },

          orderBy: [
            {
              created_at:
                "desc",
            },
            {
              id:
                "desc",
            },
          ],
        },
      },
    });

  if (!student) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.STUDENT_NOT_FOUND,

      message:
        "Student record was not found.",
    });
  }

  const registrationStudent: RegistrationStudent = {
    id:
      student.id,

    studentId:
      student.student_id,

    fullName:
      student.full_name,

    status:
      student.current_status,
  };

  if (
    normalizeUpper(
      student.current_status
    ) !== "ACTIVE"
  ) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.STUDENT_NOT_ACTIVE,

      message:
        "Course registration is unavailable because the student is not active.",

      student:
        registrationStudent,
    });
  }

  const activeEnrollments =
    student.enrollments;

  if (
    activeEnrollments.length ===
    0
  ) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.NO_ACTIVE_ENROLLMENT,

      message:
        "No active academic enrollment was found for this student.",

      student:
        registrationStudent,

      diagnostics: {
        activeEnrollmentCount:
          0,

        currentTermCount:
          0,

        confirmedOfferingCount:
          0,

        eligibleCourseCount:
          0,

        programIdentitySource:
          null,
      },
    });
  }

  /*
   * Never silently select one enrollment when multiple ACTIVE
   * records exist.
   */
  if (
    activeEnrollments.length >
    1
  ) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.AMBIGUOUS_ACTIVE_ENROLLMENT,

      message:
        "Multiple active academic enrollments were found. Registration is blocked until the enrollment records are reviewed.",

      student:
        registrationStudent,

      diagnostics: {
        activeEnrollmentCount:
          activeEnrollments.length,

        currentTermCount:
          0,

        confirmedOfferingCount:
          0,

        eligibleCourseCount:
          0,

        programIdentitySource:
          null,
      },
    });
  }

  const activeEnrollment =
    activeEnrollments[0];

  if (
    !activeEnrollment.batch_id ||
    !activeEnrollment.batches
  ) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.ENROLLMENT_HAS_NO_BATCH,

      message:
        "The active enrollment does not have a valid batch assignment.",

      student:
        registrationStudent,

      diagnostics: {
        activeEnrollmentCount:
          1,

        currentTermCount:
          0,

        confirmedOfferingCount:
          0,

        eligibleCourseCount:
          0,

        programIdentitySource:
          null,
      },
    });
  }

  const registrationEnrollment: RegistrationEnrollment = {
    id:
      activeEnrollment.id,

    operationalProgramId:
      activeEnrollment.program_id,

    operationalProgramCode:
      activeEnrollment.program.short_name,

    operationalProgramName:
      activeEnrollment.program.name,

    operationalBatchId:
      activeEnrollment.batches.id,

    batchCode:
      activeEnrollment.batches.batch_code,

    curriculumKey:
      activeEnrollment.curriculum_key,

    admissionSemester:
      activeEnrollment.admission_semester,
  };

  /*
   * ----------------------------------------------------------
   * 2. Determine CURRENT program/curriculum identity.
   *
   * IMPORTANT:
   * Student-ID suffix is intentionally NOT used here.
   *
   * A student may migrate between departments while retaining
   * the original institutional student ID.
   *
   * Identity priority:
   *
   * 1. explicit enrollment.curriculum_key
   * 2. current operational enrollment program code
   * ----------------------------------------------------------
   */

  let catalogIdentity:
    | {
        department_code:
          string;

        department_name:
          string;

        program_code:
          string;

        program_title:
          string;

        study_shift:
          string;
      }
    | null =
    null;

  let programIdentitySource:
    | "CURRICULUM_KEY"
    | "OPERATIONAL_PROGRAM_CODE"
    | null =
    null;

  if (
    activeEnrollment.curriculum_key
  ) {
    const catalogByCurriculum =
      await prisma.academic_catalog_entries.findFirst({
        where: {
          OR: [
            {
              curriculum_key:
                activeEnrollment.curriculum_key,
            },
            {
              program_code:
                activeEnrollment.curriculum_key,
            },
          ],
        },

        select: {
          department_code:
            true,

          department_name:
            true,

          program_code:
            true,

          program_title:
            true,

          study_shift:
            true,
        },
      });

    if (
      catalogByCurriculum
    ) {
      catalogIdentity =
        catalogByCurriculum;

      programIdentitySource =
        "CURRICULUM_KEY";
    }
  }

  if (!catalogIdentity) {
    const operationalProgramCode =
      normalizeText(
        activeEnrollment.program.short_name
      );

    const catalogByOperationalProgram =
      await prisma.academic_catalog_entries.findFirst({
        where: {
          OR: [
            {
              program_code:
                operationalProgramCode,
            },
            {
              curriculum_key:
                operationalProgramCode,
            },
          ],
        },

        select: {
          department_code:
            true,

          department_name:
            true,

          program_code:
            true,

          program_title:
            true,

          study_shift:
            true,
        },
      });

    if (
      catalogByOperationalProgram
    ) {
      catalogIdentity =
        catalogByOperationalProgram;

      programIdentitySource =
        "OPERATIONAL_PROGRAM_CODE";
    }
  }

  /*
   * If the operational program is already canonical and no
   * catalog row was obtained above, attempt to identify a
   * catalog entry through department + program title/shift
   * compatibility.
   *
   * This remains read-only.
   */
  if (
    !catalogIdentity &&
    normalizeUpper(
      activeEnrollment.program.short_name
    ).startsWith(
      "CANON-"
    )
  ) {
    const departmentCode =
      activeEnrollment.program.departments.short_name;

    const possibleCatalogRows =
      await prisma.academic_catalog_entries.findMany({
        where: {
          department_code: {
            equals:
              departmentCode,

            mode:
              "insensitive",
          },

          is_active:
            true,
        },

        select: {
          department_code:
            true,

          department_name:
            true,

          program_code:
            true,

          program_title:
            true,

          study_shift:
            true,
        },

        orderBy: {
          id:
            "asc",
        },
      });

    const canonicalCandidateMatches = [];

    for (
      const possibleCatalog
      of possibleCatalogRows
    ) {
      const possibleCanonical =
        await findCanonicalProgram({
          department_code:
            possibleCatalog.department_code,

          department_name:
            possibleCatalog.department_name,

          program_code:
            possibleCatalog.program_code,

          program_title:
            possibleCatalog.program_title,

          study_shift:
            possibleCatalog.study_shift,
        });

      if (
        possibleCanonical?.id ===
        activeEnrollment.program_id
      ) {
        canonicalCandidateMatches.push(
          possibleCatalog
        );
      }
    }

    /*
     * Multiple curriculum versions may intentionally resolve
     * to the same canonical program. We only need a valid
     * identity for locating the canonical program itself.
     */
    if (
      canonicalCandidateMatches.length >
      0
    ) {
      catalogIdentity =
        canonicalCandidateMatches[0];

      programIdentitySource =
        "OPERATIONAL_PROGRAM_CODE";
    }
  }

  if (!catalogIdentity) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.PROGRAM_IDENTITY_NOT_FOUND,

      message:
        "The student's current academic program could not be mapped to an academic catalog identity.",

      student:
        registrationStudent,

      enrollment:
        registrationEnrollment,

      diagnostics: {
        activeEnrollmentCount:
          1,

        currentTermCount:
          0,

        confirmedOfferingCount:
          0,

        eligibleCourseCount:
          0,

        programIdentitySource:
          null,
      },
    });
  }

  const canonicalProgram =
    await findCanonicalProgram({
      department_code:
        catalogIdentity.department_code,

      department_name:
        catalogIdentity.department_name,

      program_code:
        catalogIdentity.program_code,

      program_title:
        catalogIdentity.program_title,

      study_shift:
        catalogIdentity.study_shift,
    });

  if (!canonicalProgram) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.CANONICAL_PROGRAM_NOT_FOUND,

      message:
        "The student's current program could not be resolved to a canonical offering program.",

      student:
        registrationStudent,

      enrollment:
        registrationEnrollment,

      diagnostics: {
        activeEnrollmentCount:
          1,

        currentTermCount:
          0,

        confirmedOfferingCount:
          0,

        eligibleCourseCount:
          0,

        programIdentitySource,
      },
    });
  }

  const registrationCanonicalProgram: RegistrationCanonicalProgram = {
    id:
      canonicalProgram.id,

    shortName:
      canonicalProgram.short_name,

    name:
      canonicalProgram.name,
  };

  /*
   * ----------------------------------------------------------
   * 3. Resolve canonical batch by:
   *
   * canonical program + CURRENT enrollment batch code.
   *
   * Do not use operational batch_id directly because legacy
   * student-enrollment batch rows can coexist with canonical
   * offering batch rows.
   * ----------------------------------------------------------
   */

  const canonicalBatch =
    await prisma.batches.findFirst({
      where: {
        program_id:
          canonicalProgram.id,

        batch_code:
          activeEnrollment.batches.batch_code,

        is_active:
          true,
      },

      select: {
        id:
          true,

        batch_code:
          true,

        admission_term:
          true,
      },
    });

  if (!canonicalBatch) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.CANONICAL_BATCH_NOT_FOUND,

      message:
        "A canonical offering batch could not be found for the student's current batch.",

      student:
        registrationStudent,

      enrollment:
        registrationEnrollment,

      canonicalProgram:
        registrationCanonicalProgram,

      diagnostics: {
        activeEnrollmentCount:
          1,

        currentTermCount:
          0,

        confirmedOfferingCount:
          0,

        eligibleCourseCount:
          0,

        programIdentitySource,
      },
    });
  }

  const registrationCanonicalBatch: RegistrationCanonicalBatch = {
    id:
      canonicalBatch.id,

    batchCode:
      canonicalBatch.batch_code,

    admissionTerm:
      canonicalBatch.admission_term,
  };

  /*
   * ----------------------------------------------------------
   * 4. Current academic term.
   * ----------------------------------------------------------
   */

  const currentTerms =
    await prisma.academic_terms.findMany({
      where: {
        is_current:
          true,
      },

      select: {
        id:
          true,

        name:
          true,

        year:
          true,

        term_type:
          true,
      },

      orderBy: {
        id:
          "asc",
      },
    });

  if (
    currentTerms.length ===
    0
  ) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.CLOSED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.NO_CURRENT_TERM,

      message:
        "Course registration is closed because no current academic term is configured.",

      student:
        registrationStudent,

      enrollment:
        registrationEnrollment,

      canonicalProgram:
        registrationCanonicalProgram,

      canonicalBatch:
        registrationCanonicalBatch,

      diagnostics: {
        activeEnrollmentCount:
          1,

        currentTermCount:
          0,

        confirmedOfferingCount:
          0,

        eligibleCourseCount:
          0,

        programIdentitySource,
      },
    });
  }

  if (
    currentTerms.length >
    1
  ) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.BLOCKED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.MULTIPLE_CURRENT_TERMS,

      message:
        "Registration is blocked because multiple academic terms are marked as current.",

      student:
        registrationStudent,

      enrollment:
        registrationEnrollment,

      canonicalProgram:
        registrationCanonicalProgram,

      canonicalBatch:
        registrationCanonicalBatch,

      diagnostics: {
        activeEnrollmentCount:
          1,

        currentTermCount:
          currentTerms.length,

        confirmedOfferingCount:
          0,

        eligibleCourseCount:
          0,

        programIdentitySource,
      },
    });
  }

  const currentTerm =
    currentTerms[0];

  const registrationAcademicTerm: RegistrationAcademicTerm = {
    id:
      currentTerm.id,

    name:
      currentTerm.name,

    year:
      currentTerm.year,

    termType:
      currentTerm.term_type,
  };

  /*
   * ----------------------------------------------------------
   * 5. CONFIRMED offering source only.
   * ----------------------------------------------------------
   */

  const confirmedOfferings =
    await prisma.offerings.findMany({
      where: {
        academic_term_id:
          currentTerm.id,

        program_id:
          canonicalProgram.id,

        status:
          "CONFIRMED",
      },

      select: {
        id:
          true,
      },

      orderBy: {
        id:
          "asc",
      },
    });

  if (
    confirmedOfferings.length ===
    0
  ) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.CLOSED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.NO_CONFIRMED_OFFERING,

      message:
        `Course registration is not open yet because no confirmed offering exists for ${currentTerm.name}.`,

      student:
        registrationStudent,

      enrollment:
        registrationEnrollment,

      canonicalProgram:
        registrationCanonicalProgram,

      canonicalBatch:
        registrationCanonicalBatch,

      academicTerm:
        registrationAcademicTerm,

      diagnostics: {
        activeEnrollmentCount:
          1,

        currentTermCount:
          1,

        confirmedOfferingCount:
          0,

        eligibleCourseCount:
          0,

        programIdentitySource,
      },
    });
  }

  const confirmedOfferingIds =
    confirmedOfferings.map(
      (offering) =>
        offering.id
    );

  /*
   * ----------------------------------------------------------
   * 6. Candidate courses are limited to:
   *
   * - current academic term
   * - canonical program
   * - CONFIRMED offering
   * - canonical batch link
   * ----------------------------------------------------------
   */

  const offeredCourseBatchLinks =
    await prisma.offered_course_batches.findMany({
      where: {
        batch_id:
          canonicalBatch.id,

        offered_courses: {
          offering_id: {
            in:
              confirmedOfferingIds,
          },

          offerings: {
            academic_term_id:
              currentTerm.id,

            program_id:
              canonicalProgram.id,

            status:
              "CONFIRMED",
          },
        },
      },

      select: {
        id:
          true,

        offered_course_id:
          true,

        offered_courses: {
          select: {
            id:
              true,

            offering_id:
              true,

            section:
              true,

            is_cooffered:
              true,

            offerings: {
              select: {
                status:
                  true,
              },
            },

            master_courses: {
              select: {
                id:
                  true,

                course_code:
                  true,

                course_title:
                  true,

                credit:
                  true,

                course_type:
                  true,

                level_term:
                  true,

                curriculum_key:
                  true,
              },
            },

            offered_course_teachers: {
              select: {
                assigned_credit:
                  true,

                load_type:
                  true,

                teachers: {
                  select: {
                    id:
                      true,

                    teacher_code:
                      true,

                    full_name:
                      true,

                    designation:
                      true,
                  },
                },
              },

              orderBy: {
                id:
                  "asc",
              },
            },

            offered_course_slots: {
              select: {
                id:
                  true,

                day_of_week:
                  true,

                start_time:
                  true,

                end_time:
                  true,

                slot_type:
                  true,

                room_id:
                  true,

                rooms: {
                  select: {
                    room_code:
                      true,

                    room_type:
                      true,

                    capacity:
                      true,
                  },
                },
              },

              orderBy: [
                {
                  day_of_week:
                    "asc",
                },
                {
                  start_time:
                    "asc",
                },
                {
                  id:
                    "asc",
                },
              ],
            },
          },
        },
      },

      orderBy: {
        id:
          "asc",
      },
    });

  const eligibleCourses: StudentRegistrationEligibleCourse[] =
    offeredCourseBatchLinks.map(
      (link) => ({
        offeredCourseId:
          link.offered_courses.id,

        offeringId:
          link.offered_courses.offering_id,

        offeringStatus:
          link.offered_courses.offerings.status,

        masterCourseId:
          link.offered_courses.master_courses.id,

        courseCode:
          link.offered_courses.master_courses.course_code,

        courseTitle:
          link.offered_courses.master_courses.course_title,

        credit:
          link.offered_courses.master_courses.credit,

        courseType:
          link.offered_courses.master_courses.course_type,

        levelTerm:
          link.offered_courses.master_courses.level_term,

        curriculumKey:
          link.offered_courses.master_courses.curriculum_key,

        section:
          link.offered_courses.section,

        isCooffered:
          Boolean(
            link.offered_courses.is_cooffered
          ),

        batchLinkId:
          link.id,

        teachers:
          link.offered_courses.offered_course_teachers.map(
            (assignment) => ({
              teacherId:
                assignment.teachers.id,

              teacherCode:
                assignment.teachers.teacher_code,

              fullName:
                assignment.teachers.full_name,

              designation:
                assignment.teachers.designation,

              assignedCredit:
                assignment.assigned_credit,

              loadType:
                assignment.load_type,
            })
          ),

        slots:
          link.offered_courses.offered_course_slots.map(
            (slot) => ({
              slotId:
                slot.id,

              dayOfWeek:
                slot.day_of_week,

              startTime:
                slot.start_time,

              endTime:
                slot.end_time,

              slotType:
                slot.slot_type,

              roomId:
                slot.room_id,

              roomCode:
                slot.rooms.room_code,

              roomType:
                slot.rooms.room_type,

              roomCapacity:
                slot.rooms.capacity,
            })
          ),
      })
    );

  if (
    eligibleCourses.length ===
    0
  ) {
    return createBaseContext({
      status:
        STUDENT_REGISTRATION_CONTEXT_STATUS.CLOSED,

      reason:
        STUDENT_REGISTRATION_CONTEXT_REASON.NO_BATCH_LINKED_COURSES,

      message:
        "A confirmed offering exists, but no offered courses are linked to the student's canonical batch.",

      student:
        registrationStudent,

      enrollment:
        registrationEnrollment,

      canonicalProgram:
        registrationCanonicalProgram,

      canonicalBatch:
        registrationCanonicalBatch,

      academicTerm:
        registrationAcademicTerm,

      confirmedOfferingIds,

      diagnostics: {
        activeEnrollmentCount:
          1,

        currentTermCount:
          1,

        confirmedOfferingCount:
          confirmedOfferings.length,

        eligibleCourseCount:
          0,

        programIdentitySource,
      },
    });
  }

  return createBaseContext({
    status:
      STUDENT_REGISTRATION_CONTEXT_STATUS.READY,

    reason:
      STUDENT_REGISTRATION_CONTEXT_REASON.READY,

    message:
      `Course registration context is ready for ${currentTerm.name}.`,

    student:
      registrationStudent,

    enrollment:
      registrationEnrollment,

    canonicalProgram:
      registrationCanonicalProgram,

    canonicalBatch:
      registrationCanonicalBatch,

    academicTerm:
      registrationAcademicTerm,

    confirmedOfferingIds,

    eligibleCourses,

    diagnostics: {
      activeEnrollmentCount:
        1,

      currentTermCount:
        1,

      confirmedOfferingCount:
        confirmedOfferings.length,

      eligibleCourseCount:
        eligibleCourses.length,

      programIdentitySource,
    },
  });
}
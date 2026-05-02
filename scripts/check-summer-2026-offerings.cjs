const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PUBLIC_PROGRAMS = [
  "BSC-EEE-EVE-NEW",
  "BSC-EEE-REG-NEW",
  "BSC-RAE-REG-NEW",
  "CANON-EEE-EVE-BSCEEE",
  "CANON-EEE-REG-BSCEEE",
  "CANON-RAE-REG-BSCRAE",
];

async function main() {
  const termName = "SUMMER 2026";

  const term = await prisma.academic_terms.findFirst({
    where: { name: termName },
    select: { id: true, name: true },
  });

  if (!term) {
    console.log(`Academic term not found: ${termName}`);
    return;
  }

  const offerings = await prisma.offerings.findMany({
    where: {
      academic_term_id: term.id,
      programs: {
        short_name: {
          in: PUBLIC_PROGRAMS,
        },
      },
    },
    include: {
      programs: true,
      academic_terms: true,
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
          offered_course_slots: true,
          offered_course_teachers: {
            include: {
              teachers: true,
            },
          },
        },
      },
    },
    orderBy: [{ program_id: "asc" }, { id: "asc" }],
  });

  const summary = offerings.map((offering) => {
    const allBatches = new Set();
    let slotCount = 0;
    let teacherCount = 0;

    for (const course of offering.offered_courses) {
      for (const batchRow of course.offered_course_batches) {
        allBatches.add(batchRow.batches.batch_code);
      }

      slotCount += course.offered_course_slots.length;
      teacherCount += course.offered_course_teachers.length;
    }

    return {
      offeringId: offering.id,
      termName: offering.academic_terms.name,
      offeringProgramCode: offering.programs.short_name,
      status: offering.status,
      courseCount: offering.offered_courses.length,
      batchCount: allBatches.size,
      batches: Array.from(allBatches).sort(),
      slotCount,
      teacherAssignmentCount: teacherCount,
    };
  });

  console.log(JSON.stringify(summary, null, 2));

  const details = [];

  for (const offering of offerings) {
    for (const course of offering.offered_courses) {
      details.push({
        offeringId: offering.id,
        offeringProgramCode: offering.programs.short_name,
        status: offering.status,
        masterCourseProgramCode: course.master_courses.program.short_name,
        courseCode: course.master_courses.course_code,
        courseTitle: course.master_courses.course_title,
        section: course.section,
        batches: course.offered_course_batches
          .map((row) => row.batches.batch_code)
          .sort(),
        slotCount: course.offered_course_slots.length,
        teacherCount: course.offered_course_teachers.length,
        teachers: course.offered_course_teachers.map(
          (row) => `${row.teachers.teacher_code} - ${row.teachers.full_name}`
        ),
      });
    }
  }

  require("fs").writeFileSync(
    "summer_2026_offering_diagnostic.json",
    JSON.stringify({ summary, details }, null, 2),
    "utf8"
  );

  console.log("DONE: summer_2026_offering_diagnostic.json created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
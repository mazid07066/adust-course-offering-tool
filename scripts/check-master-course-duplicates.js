const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.master_courses.findMany({
    select: {
      id: true,
      curriculum_key: true,
      course_code: true,
      course_title: true,
      program_id: true,
    },
    orderBy: [
      { curriculum_key: "asc" },
      { course_code: "asc" },
      { id: "asc" },
    ],
  });

  const map = new Map();

  for (const row of rows) {
    const key = `${row.curriculum_key ?? "NULL"}||${row.course_code}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(row);
  }

  const duplicates = [...map.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      count: items.length,
      rows: items,
    }));

  if (!duplicates.length) {
    console.log("NO_DUPLICATES_FOUND");
    return;
  }

  console.log("DUPLICATES_FOUND");
  console.log(JSON.stringify(duplicates, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
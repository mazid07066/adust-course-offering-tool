import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const username = "admin";
  const password = "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.users.upsert({
    where: {
      username,
    },
    update: {
      full_name: "System Administrator",
      password_hash: passwordHash,
      role: "SUPER_ADMIN",
      is_active: true,
      teacher_id: null,
    },
    create: {
      username,
      full_name: "System Administrator",
      password_hash: passwordHash,
      role: "SUPER_ADMIN",
      is_active: true,
      teacher_id: null,
    },
  });

  console.log("Seed completed.");
  console.log("Default admin username:", username);
  console.log("Default admin password:", password);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
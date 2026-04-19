const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const existingPrivilegedUser = await prisma.users.findFirst({
    where: {
      is_active: true,
      role: {
        in: ["SUPER_ADMIN", "COORDINATOR"],
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  if (existingPrivilegedUser) {
    console.log("An active privileged user already exists:");
    console.log({
      id: existingPrivilegedUser.id,
      username: existingPrivilegedUser.username,
      full_name: existingPrivilegedUser.full_name,
      role: existingPrivilegedUser.role,
      is_active: existingPrivilegedUser.is_active,
    });
    return;
  }

  const passwordHash = await bcrypt.hash("Admin@12345", 10);

  const saved = await prisma.users.upsert({
    where: {
      username: "admin",
    },
    update: {
      full_name: "Super Admin",
      password_hash: passwordHash,
      role: "SUPER_ADMIN",
      is_active: true,
      teacher_id: null,
    },
    create: {
      username: "admin",
      full_name: "Super Admin",
      password_hash: passwordHash,
      role: "SUPER_ADMIN",
      is_active: true,
      teacher_id: null,
    },
  });

  console.log("Default SUPER_ADMIN created successfully.");
  console.log({
    id: saved.id,
    username: saved.username,
    full_name: saved.full_name,
    role: saved.role,
    is_active: saved.is_active,
  });
  console.log("");
  console.log("Login credentials:");
  console.log("Username: admin");
  console.log("Password: Admin@12345");
}

main()
  .catch((error) => {
    console.error("Bootstrap admin failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
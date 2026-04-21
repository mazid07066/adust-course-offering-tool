const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function upsertAdmin(username, passwordHash) {
  return prisma.users.upsert({
    where: { username },
    update: {
      full_name: "Super Admin",
      password_hash: passwordHash,
      role: "SUPER_ADMIN",
      is_active: true,
      teacher_id: null,
    },
    create: {
      username,
      full_name: "Super Admin",
      password_hash: passwordHash,
      role: "SUPER_ADMIN",
      is_active: true,
      teacher_id: null,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 10);

  const adminUser = await upsertAdmin("admin", passwordHash);
  const adminEmailUser = await upsertAdmin("admin@adust.local", passwordHash);

  console.log("Force reset completed successfully.");
  console.log("");
  console.log("Account 1:");
  console.log({
    id: adminUser.id,
    username: adminUser.username,
    full_name: adminUser.full_name,
    role: adminUser.role,
    is_active: adminUser.is_active,
  });
  console.log("");
  console.log("Account 2:");
  console.log({
    id: adminEmailUser.id,
    username: adminEmailUser.username,
    full_name: adminEmailUser.full_name,
    role: adminEmailUser.role,
    is_active: adminEmailUser.is_active,
  });
  console.log("");
  console.log("You can now log in using either of these:");
  console.log("Username: admin");
  console.log("Password: Admin@12345");
  console.log("");
  console.log("OR");
  console.log("");
  console.log("Username: admin@adust.local");
  console.log("Password: Admin@12345");
}

main()
  .catch((error) => {
    console.error("Force reset admin failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
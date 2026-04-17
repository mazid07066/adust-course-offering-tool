import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertSemester(code: string, title: string, isActive = true) {
  return prisma.semester.upsert({
    where: { code },
    update: { title, isActive },
    create: { code, title, isActive },
  });
}

async function upsertDepartment(code: string, name: string) {
  return prisma.department.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });
}

async function upsertProgram(params: {
  code: string;
  name: string;
  departmentId: string;
  totalSemesters?: number | null;
  isActive?: boolean;
}) {
  return prisma.program.upsert({
    where: { code: params.code },
    update: {
      name: params.name,
      departmentId: params.departmentId,
      totalSemesters: params.totalSemesters ?? null,
      isActive: params.isActive ?? true,
    },
    create: {
      code: params.code,
      name: params.name,
      departmentId: params.departmentId,
      totalSemesters: params.totalSemesters ?? null,
      isActive: params.isActive ?? true,
    },
  });
}

async function upsertBatch(params: {
  programId: string;
  code: string;
  displayName: string;
  admissionSemester?: string;
  expectedGradYear?: number | null;
  isActive?: boolean;
}) {
  return prisma.batch.upsert({
    where: {
      programId_code: {
        programId: params.programId,
        code: params.code,
      },
    },
    update: {
      displayName: params.displayName,
      admissionSemester: params.admissionSemester ?? "Unknown",
      expectedGradYear: params.expectedGradYear ?? null,
      isActive: params.isActive ?? true,
    },
    create: {
      programId: params.programId,
      code: params.code,
      displayName: params.displayName,
      admissionSemester: params.admissionSemester ?? "Unknown",
      expectedGradYear: params.expectedGradYear ?? null,
      isActive: params.isActive ?? true,
    },
  });
}

async function upsertFaculty(params: {
  departmentId: string;
  initial: string;
  name: string;
  designation?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
}) {
  return prisma.faculty.upsert({
    where: {
      initial: params.initial,
    },
    update: {
      departmentId: params.departmentId,
      name: params.name,
      designation: params.designation ?? null,
      phone: params.phone ?? null,
      email: params.email ?? null,
      isActive: params.isActive ?? true,
    },
    create: {
      departmentId: params.departmentId,
      initial: params.initial,
      name: params.name,
      designation: params.designation ?? null,
      phone: params.phone ?? null,
      email: params.email ?? null,
      isActive: params.isActive ?? true,
    },
  });
}

async function upsertRoom(params: {
  roomCode: string;
  capacity?: number | null;
  departmentId?: string | null;
  isActive?: boolean;
}) {
  return prisma.room.upsert({
    where: {
      roomCode: params.roomCode,
    },
    update: {
      capacity: params.capacity ?? null,
      departmentId: params.departmentId ?? null,
      isActive: params.isActive ?? true,
    },
    create: {
      roomCode: params.roomCode,
      capacity: params.capacity ?? null,
      departmentId: params.departmentId ?? null,
      isActive: params.isActive ?? true,
    },
  });
}

async function upsertUser(params: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  departmentId?: string | null;
  facultyId?: string | null;
  isActive?: boolean;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);

  return prisma.user.upsert({
    where: { email: params.email.toLowerCase() },
    update: {
      name: params.name,
      passwordHash,
      role: params.role,
      departmentId: params.departmentId ?? null,
      facultyId: params.facultyId ?? null,
      isActive: params.isActive ?? true,
    },
    create: {
      name: params.name,
      email: params.email.toLowerCase(),
      passwordHash,
      role: params.role,
      departmentId: params.departmentId ?? null,
      facultyId: params.facultyId ?? null,
      isActive: params.isActive ?? true,
    },
  });
}

async function main() {
  console.log("Seeding started...");

  // -----------------------------
  // Semesters
  // -----------------------------
  const semesterData = [
    { code: "SPRING-2025", title: "SPRING 2025" },
    { code: "SUMMER-2025", title: "SUMMER 2025" },
    { code: "FALL-2025", title: "FALL 2025" },
    { code: "SPRING-2026", title: "SPRING 2026" },
    { code: "SUMMER-2026", title: "SUMMER 2026" },
    { code: "FALL-2026", title: "FALL 2026" },
    { code: "SPRING-2027", title: "SPRING 2027" },
    { code: "SUMMER-2027", title: "SUMMER 2027" },
    { code: "FALL-2027", title: "FALL 2027" },
  ];

  for (const semester of semesterData) {
    await upsertSemester(semester.code, semester.title, true);
  }

  // -----------------------------
  // Departments
  // -----------------------------
  const eeeDept = await upsertDepartment("EEE", "Electrical and Electronic Engineering");
  const cseDept = await upsertDepartment("CSE", "Computer Science and Engineering");
  const raeDept = await upsertDepartment("RAE", "Robotics and Automation Engineering");
  const bbaDept = await upsertDepartment("BBA", "Business Administration");

  // -----------------------------
  // Programs
  // -----------------------------
  const eeeProgram = await upsertProgram({
    code: "BSC-EEE",
    name: "B.Sc. in Electrical and Electronic Engineering",
    departmentId: eeeDept.id,
    totalSemesters: 8,
    isActive: true,
  });

  const cseProgram = await upsertProgram({
    code: "BSC-CSE",
    name: "B.Sc. in Computer Science and Engineering",
    departmentId: cseDept.id,
    totalSemesters: 8,
    isActive: true,
  });

  const raeProgram = await upsertProgram({
    code: "BSC-RAE",
    name: "B.Sc. in Robotics and Automation Engineering",
    departmentId: raeDept.id,
    totalSemesters: 8,
    isActive: true,
  });

  const bbaProgram = await upsertProgram({
    code: "BBA",
    name: "Bachelor of Business Administration",
    departmentId: bbaDept.id,
    totalSemesters: 8,
    isActive: true,
  });

  // -----------------------------
  // Batches
  // -----------------------------
  const batchData = [
    { programId: raeProgram.id, code: "231", displayName: "RAE Batch 231", admissionSemester: "SPRING 2023", expectedGradYear: 2027 },
    { programId: raeProgram.id, code: "232", displayName: "RAE Batch 232", admissionSemester: "SUMMER 2023", expectedGradYear: 2027 },
    { programId: raeProgram.id, code: "233", displayName: "RAE Batch 233", admissionSemester: "FALL 2023", expectedGradYear: 2027 },

    { programId: eeeProgram.id, code: "231", displayName: "EEE Batch 231", admissionSemester: "SPRING 2023", expectedGradYear: 2027 },
    { programId: eeeProgram.id, code: "232", displayName: "EEE Batch 232", admissionSemester: "SUMMER 2023", expectedGradYear: 2027 },

    { programId: cseProgram.id, code: "231", displayName: "CSE Batch 231", admissionSemester: "SPRING 2023", expectedGradYear: 2027 },
    { programId: cseProgram.id, code: "232", displayName: "CSE Batch 232", admissionSemester: "SUMMER 2023", expectedGradYear: 2027 },

    { programId: bbaProgram.id, code: "231", displayName: "BBA Batch 231", admissionSemester: "SPRING 2023", expectedGradYear: 2027 },
  ];

  for (const batch of batchData) {
    await upsertBatch(batch);
  }

  // -----------------------------
  // Faculties
  // -----------------------------
  const faculty1 = await upsertFaculty({
    departmentId: raeDept.id,
    initial: "MZI",
    name: "Md. Ziaul Islam",
    designation: "Assistant Professor",
    phone: "01710000001",
    email: "mzi@adust.edu.bd",
    isActive: true,
  });

  const faculty2 = await upsertFaculty({
    departmentId: raeDept.id,
    initial: "NAR",
    name: "Nafees A. রহমান",
    designation: "Lecturer",
    phone: "01710000002",
    email: "nar@adust.edu.bd",
    isActive: true,
  });

  const faculty3 = await upsertFaculty({
    departmentId: eeeDept.id,
    initial: "RAK",
    name: "Rakib Hasan",
    designation: "Associate Professor",
    phone: "01710000003",
    email: "rak@adust.edu.bd",
    isActive: true,
  });

  const faculty4 = await upsertFaculty({
    departmentId: cseDept.id,
    initial: "SMM",
    name: "Sadia M. Mitu",
    designation: "Assistant Professor",
    phone: "01710000004",
    email: "smm@adust.edu.bd",
    isActive: true,
  });

  const faculty5 = await upsertFaculty({
    departmentId: bbaDept.id,
    initial: "FAR",
    name: "Farhana Rahman",
    designation: "Senior Lecturer",
    phone: "01710000005",
    email: "far@adust.edu.bd",
    isActive: true,
  });

  // -----------------------------
  // Rooms
  // -----------------------------
  const roomData = [
    { roomCode: "A-101", capacity: 40, departmentId: raeDept.id },
    { roomCode: "A-102", capacity: 40, departmentId: raeDept.id },
    { roomCode: "B-201", capacity: 50, departmentId: eeeDept.id },
    { roomCode: "B-202", capacity: 50, departmentId: eeeDept.id },
    { roomCode: "C-301", capacity: 45, departmentId: cseDept.id },
    { roomCode: "LAB-1", capacity: 30, departmentId: cseDept.id },
    { roomCode: "LAB-2", capacity: 30, departmentId: raeDept.id },
    { roomCode: "BUS-401", capacity: 60, departmentId: bbaDept.id },
  ];

  for (const room of roomData) {
    await upsertRoom(room);
  }

  // -----------------------------
  // Default users
  // -----------------------------
  await upsertUser({
    name: "Super Admin",
    email: "admin@adust.local",
    password: "Admin@12345",
    role: UserRole.SUPER_ADMIN,
    isActive: true,
  });

  await upsertUser({
    name: "Default Coordinator RAE",
    email: "coordinator.rae@adust.local",
    password: "Coordinator@12345",
    role: UserRole.COORDINATOR,
    departmentId: raeDept.id,
    isActive: true,
  });

  await upsertUser({
    name: "Default Coordinator EEE",
    email: "coordinator.eee@adust.local",
    password: "Coordinator@12345",
    role: UserRole.COORDINATOR,
    departmentId: eeeDept.id,
    isActive: true,
  });

  await upsertUser({
    name: faculty1.name,
    email: "faculty.rae@adust.local",
    password: "Faculty@12345",
    role: UserRole.FACULTY,
    departmentId: raeDept.id,
    facultyId: faculty1.id,
    isActive: true,
  });

  await upsertUser({
    name: faculty3.name,
    email: "faculty.eee@adust.local",
    password: "Faculty@12345",
    role: UserRole.FACULTY,
    departmentId: eeeDept.id,
    facultyId: faculty3.id,
    isActive: true,
  });

  await upsertUser({
    name: faculty4.name,
    email: "faculty.cse@adust.local",
    password: "Faculty@12345",
    role: UserRole.FACULTY,
    departmentId: cseDept.id,
    facultyId: faculty4.id,
    isActive: true,
  });

  console.log("Seeding completed successfully.");
  console.log("");
  console.log("Default login accounts:");
  console.log("Super Admin    : admin@adust.local / Admin@12345");
  console.log("Coordinator RAE: coordinator.rae@adust.local / Coordinator@12345");
  console.log("Coordinator EEE: coordinator.eee@adust.local / Coordinator@12345");
  console.log("Faculty RAE    : faculty.rae@adust.local / Faculty@12345");
  console.log("Faculty EEE    : faculty.eee@adust.local / Faculty@12345");
  console.log("Faculty CSE    : faculty.cse@adust.local / Faculty@12345");
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
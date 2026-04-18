import { prisma } from "@/lib/prisma";

type AcademicIdentity = {
  department_code: string;
  department_name: string;
  program_code: string;
  program_title: string;
  study_shift: string;
};

function normalizeText(value: string) {
  return String(value || "").trim();
}

function normalizeUpper(value: string) {
  return normalizeText(value).toUpperCase();
}

function slugCompact(value: string) {
  return normalizeUpper(value).replace(/[^A-Z0-9]+/g, "");
}

function buildCanonicalProgramName(identity: AcademicIdentity) {
  return `${normalizeText(identity.program_title)} [${normalizeUpper(identity.study_shift)}]`;
}

function buildCanonicalProgramShortName(identity: AcademicIdentity) {
  const raw = `CANON-${normalizeUpper(identity.department_code)}-${normalizeUpper(identity.study_shift)}-${slugCompact(identity.program_title)}`;
  return raw.slice(0, 50);
}

export async function resolveCanonicalDepartment(identity: AcademicIdentity) {
  const departmentCode = normalizeUpper(identity.department_code);
  const departmentName = normalizeText(identity.department_name);

  let department = await prisma.departments.findFirst({
    where: {
      OR: [{ short_name: departmentCode }, { name: departmentName }],
    },
  });

  if (!department) {
    department = await prisma.departments.create({
      data: {
        short_name: departmentCode,
        name: departmentName,
      },
    });
  }

  return department;
}

export async function resolveCanonicalProgram(identity: AcademicIdentity) {
  const department = await resolveCanonicalDepartment(identity);
  const canonicalName = buildCanonicalProgramName(identity);
  const canonicalShortName = buildCanonicalProgramShortName(identity);

  let program = await prisma.programs.findFirst({
    where: {
      department_id: department.id,
      name: canonicalName,
    },
  });

  if (!program) {
    program = await prisma.programs.findFirst({
      where: {
        short_name: canonicalShortName,
      },
    });
  }

  if (!program) {
    program = await prisma.programs.create({
      data: {
        department_id: department.id,
        name: canonicalName,
        short_name: canonicalShortName,
      },
    });
  } else {
    program = await prisma.programs.update({
      where: { id: program.id },
      data: {
        department_id: department.id,
        name: canonicalName,
        short_name: canonicalShortName,
      },
    });
  }

  return program;
}
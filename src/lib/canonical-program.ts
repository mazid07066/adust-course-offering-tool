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
  return normalizeUpper(value).replace(
    /[^A-Z0-9]+/g,
    ""
  );
}

function buildCanonicalProgramName(
  identity: AcademicIdentity
) {
  return `${normalizeText(
    identity.program_title
  )} [${normalizeUpper(
    identity.study_shift
  )}]`;
}

function buildCanonicalProgramShortName(
  identity: AcademicIdentity
) {
  const raw =
    `CANON-${normalizeUpper(
      identity.department_code
    )}-${normalizeUpper(
      identity.study_shift
    )}-${slugCompact(
      identity.program_title
    )}`;

  return raw.slice(0, 50);
}

/**
 * Read-only canonical department lookup.
 *
 * This function NEVER creates or updates database rows.
 * Use it from previews, reports, validation, and other
 * operations that must not mutate database state.
 */
export async function findCanonicalDepartment(
  identity: AcademicIdentity
) {
  const departmentCode =
    normalizeUpper(
      identity.department_code
    );

  const departmentName =
    normalizeText(
      identity.department_name
    );

  return prisma.departments.findFirst({
    where: {
      OR: [
        {
          short_name:
            departmentCode,
        },
        {
          name:
            departmentName,
        },
      ],
    },
  });
}

/**
 * Read-only canonical program lookup.
 *
 * The matching rules are identical to resolveCanonicalProgram(),
 * but this function NEVER creates or updates rows.
 */
export async function findCanonicalProgram(
  identity: AcademicIdentity
) {
  const department =
    await findCanonicalDepartment(
      identity
    );

  if (!department) {
    return null;
  }

  const canonicalName =
    buildCanonicalProgramName(
      identity
    );

  const canonicalShortName =
    buildCanonicalProgramShortName(
      identity
    );

  const byName =
    await prisma.programs.findFirst({
      where: {
        department_id:
          department.id,

        name:
          canonicalName,
      },
    });

  if (byName) {
    return byName;
  }

  return prisma.programs.findFirst({
    where: {
      short_name:
        canonicalShortName,
    },
  });
}

/**
 * Writable canonical department resolver.
 *
 * Use only where creating or synchronizing canonical
 * database records is intended.
 */
export async function resolveCanonicalDepartment(
  identity: AcademicIdentity
) {
  const departmentCode =
    normalizeUpper(
      identity.department_code
    );

  const departmentName =
    normalizeText(
      identity.department_name
    );

  let department =
    await prisma.departments.findFirst({
      where: {
        OR: [
          {
            short_name:
              departmentCode,
          },
          {
            name:
              departmentName,
          },
        ],
      },
    });

  if (!department) {
    department =
      await prisma.departments.create({
        data: {
          short_name:
            departmentCode,

          name:
            departmentName,
        },
      });
  }

  return department;
}

/**
 * Writable canonical program resolver.
 *
 * Existing behavior is intentionally preserved for setup/save
 * operations that need canonical rows to exist and stay synced.
 */
export async function resolveCanonicalProgram(
  identity: AcademicIdentity
) {
  const department =
    await resolveCanonicalDepartment(
      identity
    );

  const canonicalName =
    buildCanonicalProgramName(
      identity
    );

  const canonicalShortName =
    buildCanonicalProgramShortName(
      identity
    );

  let program =
    await prisma.programs.findFirst({
      where: {
        department_id:
          department.id,

        name:
          canonicalName,
      },
    });

  if (!program) {
    program =
      await prisma.programs.findFirst({
        where: {
          short_name:
            canonicalShortName,
        },
      });
  }

  if (!program) {
    program =
      await prisma.programs.create({
        data: {
          department_id:
            department.id,

          name:
            canonicalName,

          short_name:
            canonicalShortName,
        },
      });
  } else {
    const needsUpdate =
      program.department_id !==
        department.id ||
      program.name !==
        canonicalName ||
      program.short_name !==
        canonicalShortName;

    if (needsUpdate) {
      program =
        await prisma.programs.update({
          where: {
            id:
              program.id,
          },

          data: {
            department_id:
              department.id,

            name:
              canonicalName,

            short_name:
              canonicalShortName,
          },
        });
    }
  }

  return program;
}
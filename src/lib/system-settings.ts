import { prisma } from "@/lib/prisma";

const DEFAULT_SETTINGS: Record<string, string> = {
  FACULTY_SESSION_MINUTES: "30",
  FACULTY_WARNING_MINUTES: "10",
  FACULTY_CHOICE_WINDOW_STATUS: "CLOSED",
  FACULTY_ACTIVE_SENIORITY_LEVEL: "",
  FACULTY_ACTIVE_TEACHER_ID: "",
  FACULTY_AUTO_ADVANCE_ON_EXPIRY: "true",
};

export type FacultyLevelCreditPolicy = {
  level: number;
  minCredits: number | null;
  maxCredits: number | null;
};

/**
 * Read a required system setting.
 *
 * Performance note:
 *
 * The previous implementation used Prisma upsert() for every read.
 * With PostgreSQL/Prisma this caused multiple SQL statements even when
 * the setting already existed.
 *
 * System settings are read very frequently during faculty login,
 * dashboard loading, faculty-turn calculation and course choice.
 *
 * Normal reads now use findUnique(), which results in one database
 * lookup. The upsert path is only used when the setting does not yet
 * exist, preserving the previous automatic-default creation behavior.
 */
export async function getSetting(key: string): Promise<string> {
  const existing = await prisma.systemSetting.findUnique({
    where: {
      settingKey: key,
    },
    select: {
      settingValue: true,
    },
  });

  if (existing) {
    return existing.settingValue;
  }

  const defaultValue = DEFAULT_SETTINGS[key] ?? "";

  const created = await prisma.systemSetting.upsert({
    where: {
      settingKey: key,
    },
    update: {},
    create: {
      settingKey: key,
      settingValue: defaultValue,
    },
    select: {
      settingValue: true,
    },
  });

  return created.settingValue;
}

export async function getOptionalSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      settingKey: key,
    },
    select: {
      settingValue: true,
    },
  });

  return setting?.settingValue ?? null;
}

export async function setSetting(
  key: string,
  value: string,
  userId?: number
) {
  return prisma.systemSetting.upsert({
    where: {
      settingKey: key,
    },
    update: {
      settingValue: value,
      updatedByUserId: userId,
    },
    create: {
      settingKey: key,
      settingValue: value,
      updatedByUserId: userId,
    },
  });
}

export async function getSettingNumber(key: string): Promise<number> {
  const value = await getSetting(key);
  const num = Number(value);

  return Number.isNaN(num) ? 0 : num;
}

export async function getOptionalSettingNumber(
  key: string
): Promise<number | null> {
  const value = await getOptionalSetting(key);

  if (value === null || value === "") {
    return null;
  }

  const num = Number(value);

  return Number.isNaN(num) ? null : num;
}

export async function getFacultySessionMinutes(): Promise<number> {
  return getSettingNumber("FACULTY_SESSION_MINUTES");
}

export async function getFacultyWarningMinutes(): Promise<number> {
  return getSettingNumber("FACULTY_WARNING_MINUTES");
}

export async function getFacultyChoiceWindowStatus(): Promise<string> {
  return getSetting("FACULTY_CHOICE_WINDOW_STATUS");
}

export async function getActiveFacultySeniorityLevel(): Promise<number | null> {
  return getOptionalSettingNumber("FACULTY_ACTIVE_SENIORITY_LEVEL");
}

export async function getActiveFacultyTeacherId(): Promise<number | null> {
  return getOptionalSettingNumber("FACULTY_ACTIVE_TEACHER_ID");
}

export async function getFacultyAutoAdvanceOnExpiry(): Promise<boolean> {
  const raw = (await getSetting("FACULTY_AUTO_ADVANCE_ON_EXPIRY"))
    .trim()
    .toLowerCase();

  return raw === "true";
}

export function getFacultyLevelMinKey(level: number) {
  return `FACULTY_LEVEL_${level}_MIN_CREDITS`;
}

export function getFacultyLevelMaxKey(level: number) {
  return `FACULTY_LEVEL_${level}_MAX_CREDITS`;
}

/**
 * Minimum and maximum credit limits are independent settings, so load
 * them concurrently instead of paying two sequential remote database
 * round trips.
 */
export async function getFacultyLevelCreditPolicy(
  level: number | null | undefined
): Promise<FacultyLevelCreditPolicy | null> {
  if (!level) {
    return null;
  }

  const [minCredits, maxCredits] = await Promise.all([
    getOptionalSettingNumber(getFacultyLevelMinKey(level)),
    getOptionalSettingNumber(getFacultyLevelMaxKey(level)),
  ]);

  return {
    level,
    minCredits,
    maxCredits,
  };
}

export async function getAllFacultyLevelCreditPolicies(
  levels = Array.from({ length: 20 }, (_, i) => i + 1)
): Promise<FacultyLevelCreditPolicy[]> {
  const items = await Promise.all(
    levels.map(async (level) => {
      const policy = await getFacultyLevelCreditPolicy(level);

      return (
        policy || {
          level,
          minCredits: null,
          maxCredits: null,
        }
      );
    })
  );

  return items;
}

export async function setFacultyLevelCreditPolicy(
  level: number,
  minCredits: number | null,
  maxCredits: number | null,
  userId?: number
) {
  const minValue =
    minCredits === null || Number.isNaN(minCredits)
      ? ""
      : String(minCredits);

  const maxValue =
    maxCredits === null || Number.isNaN(maxCredits)
      ? ""
      : String(maxCredits);

  await Promise.all([
    setSetting(
      getFacultyLevelMinKey(level),
      minValue,
      userId
    ),
    setSetting(
      getFacultyLevelMaxKey(level),
      maxValue,
      userId
    ),
  ]);
}
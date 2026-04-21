import { prisma } from "@/lib/prisma";

const DEFAULT_SETTINGS: Record<string, string> = {
  FACULTY_SESSION_MINUTES: "30",
  FACULTY_CHOICE_WINDOW_STATUS: "CLOSED",
};

export type FacultyLevelCreditPolicy = {
  level: number;
  minCredits: number | null;
  maxCredits: number | null;
};

export async function getSetting(key: string): Promise<string> {
  let setting = await prisma.systemSetting.findUnique({
    where: { settingKey: key },
  });

  if (!setting) {
    const defaultValue = DEFAULT_SETTINGS[key] ?? "";
    setting = await prisma.systemSetting.create({
      data: {
        settingKey: key,
        settingValue: defaultValue,
      },
    });
  }

  return setting.settingValue;
}

export async function getOptionalSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { settingKey: key },
  });

  return setting?.settingValue ?? null;
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

  if (value === null || value === "") return null;

  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

export async function setSetting(
  key: string,
  value: string,
  userId?: number
) {
  return prisma.systemSetting.upsert({
    where: { settingKey: key },
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

export async function getFacultySessionMinutes(): Promise<number> {
  return getSettingNumber("FACULTY_SESSION_MINUTES");
}

export async function getFacultyChoiceWindowStatus(): Promise<string> {
  return getSetting("FACULTY_CHOICE_WINDOW_STATUS");
}

export function getFacultyLevelMinKey(level: number) {
  return `FACULTY_LEVEL_${level}_MIN_CREDITS`;
}

export function getFacultyLevelMaxKey(level: number) {
  return `FACULTY_LEVEL_${level}_MAX_CREDITS`;
}

export async function getFacultyLevelCreditPolicy(
  level: number
): Promise<FacultyLevelCreditPolicy> {
  const minCredits = await getOptionalSettingNumber(getFacultyLevelMinKey(level));
  const maxCredits = await getOptionalSettingNumber(getFacultyLevelMaxKey(level));

  return {
    level,
    minCredits,
    maxCredits,
  };
}

export async function getAllFacultyLevelCreditPolicies(
  levels = [1, 2, 3, 4, 5, 6, 7]
): Promise<FacultyLevelCreditPolicy[]> {
  const policies = await Promise.all(
    levels.map((level) => getFacultyLevelCreditPolicy(level))
  );

  return policies;
}

export async function setFacultyLevelCreditPolicy(
  level: number,
  minCredits: number | null,
  maxCredits: number | null,
  userId?: number
) {
  const minValue =
    minCredits === null || Number.isNaN(minCredits) ? "" : String(minCredits);
  const maxValue =
    maxCredits === null || Number.isNaN(maxCredits) ? "" : String(maxCredits);

  await setSetting(getFacultyLevelMinKey(level), minValue, userId);
  await setSetting(getFacultyLevelMaxKey(level), maxValue, userId);
}
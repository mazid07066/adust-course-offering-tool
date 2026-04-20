import { prisma } from "@/lib/prisma";

const DEFAULT_SETTINGS: Record<string, string> = {
  FACULTY_SESSION_MINUTES: "30",
  FACULTY_CHOICE_WINDOW_STATUS: "CLOSED",
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

export async function getSettingNumber(key: string): Promise<number> {
  const value = await getSetting(key);
  const num = Number(value);
  return isNaN(num) ? 0 : num;
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
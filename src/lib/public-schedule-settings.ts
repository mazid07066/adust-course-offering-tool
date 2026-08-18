import {
  getOptionalSetting,
  setSetting,
} from "@/lib/system-settings";

export const PUBLIC_SCHEDULE_ENABLED_KEY =
  "PUBLIC_SCHEDULE_ENABLED";

export const PUBLIC_SCHEDULE_TERM_ID_KEY =
  "PUBLIC_SCHEDULE_TERM_ID";

export type PublicScheduleSettings = {
  enabled: boolean;
  academicTermId: number | null;
};

function parseBooleanSetting(value: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase() === "true";
}

function parsePositiveIntegerSetting(
  value: string | null
): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function getPublicScheduleSettings(): Promise<PublicScheduleSettings> {
  const [enabledRaw, academicTermIdRaw] =
    await Promise.all([
      getOptionalSetting(PUBLIC_SCHEDULE_ENABLED_KEY),
      getOptionalSetting(PUBLIC_SCHEDULE_TERM_ID_KEY),
    ]);

  return {
    enabled: parseBooleanSetting(enabledRaw),
    academicTermId:
      parsePositiveIntegerSetting(academicTermIdRaw),
  };
}

export async function setPublicScheduleSettings(input: {
  enabled: boolean;
  academicTermId: number | null;
  userId?: number;
}) {
  await Promise.all([
    setSetting(
      PUBLIC_SCHEDULE_ENABLED_KEY,
      String(input.enabled),
      input.userId
    ),
    setSetting(
      PUBLIC_SCHEDULE_TERM_ID_KEY,
      input.academicTermId
        ? String(input.academicTermId)
        : "",
      input.userId
    ),
  ]);
}

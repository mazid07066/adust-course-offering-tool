import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  setSetting,
  setFacultyLevelCreditPolicy,
} from "@/lib/system-settings";

export async function POST(req: NextRequest) {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const body = await req.json();

    if (body?.type === "FACULTY_LEVEL_CREDIT_POLICY") {
      const level = Number(body.level);
      const minCredits =
        body.minCredits === "" || body.minCredits === null || body.minCredits === undefined
          ? null
          : Number(body.minCredits);
      const maxCredits =
        body.maxCredits === "" || body.maxCredits === null || body.maxCredits === undefined
          ? null
          : Number(body.maxCredits);

      if (!level || level < 1 || level > 7) {
        return NextResponse.json(
          { error: "Level must be between 1 and 7." },
          { status: 400 }
        );
      }

      if (
        minCredits !== null &&
        maxCredits !== null &&
        Number(minCredits) > Number(maxCredits)
      ) {
        return NextResponse.json(
          { error: "Minimum credits cannot be greater than maximum credits." },
          { status: 400 }
        );
      }

      await setFacultyLevelCreditPolicy(
        level,
        minCredits,
        maxCredits,
        Number(guard.id)
      );

      return NextResponse.json({ success: true });
    }

    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await setSetting(String(key), String(value), Number(guard.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getFacultyChoiceWindowStatus,
  getFacultySessionMinutes,
  getAllFacultyLevelCreditPolicies,
} from "@/lib/system-settings";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  const sessionMinutes = await getFacultySessionMinutes();
  const windowStatus = await getFacultyChoiceWindowStatus();
  const levelCreditPolicies = await getAllFacultyLevelCreditPolicies();

  return NextResponse.json({
    sessionMinutes,
    windowStatus,
    levelCreditPolicies,
  });
}
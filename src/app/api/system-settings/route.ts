import { NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getActiveFacultySeniorityLevel,
  getActiveFacultyTeacherId,
  getAllFacultyLevelCreditPolicies,
  getFacultyAutoAdvanceOnExpiry,
  getFacultyChoiceWindowStatus,
  getFacultySessionMinutes,
  getFacultyWarningMinutes,
} from "@/lib/system-settings";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  const sessionMinutes = await getFacultySessionMinutes();
  const warningMinutes = await getFacultyWarningMinutes();
  const windowStatus = await getFacultyChoiceWindowStatus();
  const activeSeniorityLevel = await getActiveFacultySeniorityLevel();
  const activeTeacherId = await getActiveFacultyTeacherId();
  const autoAdvanceOnExpiry = await getFacultyAutoAdvanceOnExpiry();
  const levelCreditPolicies = await getAllFacultyLevelCreditPolicies();

  return NextResponse.json({
    sessionMinutes,
    warningMinutes,
    windowStatus,
    activeSeniorityLevel,
    activeTeacherId,
    autoAdvanceOnExpiry,
    levelCreditPolicies,
  });
}
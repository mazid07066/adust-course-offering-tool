import { NextResponse } from "next/server";
import { getFacultySessionMinutes, getFacultyChoiceWindowStatus } from "@/lib/system-settings";

export async function GET() {
  const sessionMinutes = await getFacultySessionMinutes();
  const windowStatus = await getFacultyChoiceWindowStatus();

  return NextResponse.json({
    sessionMinutes,
    windowStatus,
  });
}
import { NextResponse } from "next/server";
import { requireFacultyAction } from "@/lib/faculty-action-guard";

export async function POST() {
  const guard = await requireFacultyAction();

  if (guard instanceof Response) return guard;

  return NextResponse.json({
    success: true,
    message: "Faculty action allowed",
    userId: guard.user.id,
  });
}
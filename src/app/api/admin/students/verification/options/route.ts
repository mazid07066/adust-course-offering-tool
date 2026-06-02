import { NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { getStudentVerificationOptions } from "@/lib/student-verification";

export async function GET() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  try {
    const options = await getStudentVerificationOptions();

    return NextResponse.json({
      success: true,
      ...options,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load student verification options." },
      { status: 500 }
    );
  }
}
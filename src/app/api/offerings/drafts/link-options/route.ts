import { NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function GET() {
  await requireCoordinatorOrAdminApi();

  return NextResponse.json(
    {
      ok: false,
      error: "This route is deprecated. Use /admin/co-offering-setup for co-offering operations.",
    },
    { status: 410 }
  );
}
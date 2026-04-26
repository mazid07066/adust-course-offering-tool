import { NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import { clearReportingCacheWithLog } from "@/lib/reporting-cache";

export async function POST() {
  await requireCoordinatorOrAdminApi();

  clearReportingCacheWithLog("offering/reporting data changed");
  return NextResponse.json(
    {
      ok: false,
      error: "This route is deprecated. Use /admin/co-offering-setup for co-offering operations.",
    },
    { status: 410 }
  );
}
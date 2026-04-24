import { NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";

export async function POST() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  return NextResponse.json(
    {
      error:
        "This legacy /api/imports route is disabled. Use the current transcript and registration import routes from /admin/imports.",
    },
    { status: 410 }
  );
}

export async function DELETE() {
  const guard = await requireCoordinatorOrAdminApi();
  if (guard instanceof Response) return guard;

  return NextResponse.json(
    {
      error:
        "This legacy /api/imports reset route is disabled. Use the current cleanup/reset tools from the admin import pages.",
    },
    { status: 410 }
  );
}
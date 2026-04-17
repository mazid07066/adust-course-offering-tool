import { NextResponse } from "next/server";
import { requireCoordinatorOrAdminApi } from "@/lib/auth-guard";
import {
  getCatalogDepartmentOptions,
  getCatalogProgramOptions,
} from "@/lib/academic-catalog";

export async function GET() {
  await requireCoordinatorOrAdminApi();

  return NextResponse.json({
    success: true,
    departments: getCatalogDepartmentOptions(),
    programs: getCatalogProgramOptions(),
  });
}
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSessionUser } from "./auth-session";

/* ================= API GUARDS ================= */

export async function requireCoordinatorOrAdminApi() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "SUPER_ADMIN" && user.role !== "COORDINATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return user;
}

export async function requireSuperAdminApi() {
  const user = await getSessionUser();

  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return user;
}

/* ================= PAGE GUARDS ================= */

export async function requireCoordinatorOrAdmin() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (user.role !== "SUPER_ADMIN" && user.role !== "COORDINATOR") {
    redirect("/auth/login");
  }

  return user;
}

export async function requireSuperAdmin() {
  const user = await getSessionUser();

  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  return user;
}
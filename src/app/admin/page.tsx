import Link from "next/link";
import { auth, signOut } from "../../../auth";

export default async function AdminHomePage() {
  const session = await auth();

  const role = (session?.user as any)?.role;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">ADUST Admin Portal</h1>
            <p className="mt-2 text-slate-600">
              Logged in as {(session?.user as any)?.name} ({role})
            </p>
          </div>

          <form action={handleSignOut}>
            <button className="rounded-lg border px-4 py-2">Sign Out</button>
          </form>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {role === "SUPER_ADMIN" && (
            <>
              <Link className="rounded-lg border px-4 py-2" href="/admin/master-course-import">Master Course Import</Link>
              <Link className="rounded-lg border px-4 py-2" href="/admin/faculties">Faculties</Link>
              <Link className="rounded-lg border px-4 py-2" href="/admin/rooms">Rooms</Link>
              <Link className="rounded-lg border px-4 py-2" href="/admin/imports">Transcript & Registration Import</Link>
              <Link className="rounded-lg border px-4 py-2" href="/admin/offerings">Offerings</Link>
              <Link className="rounded-lg border px-4 py-2" href="/admin/schedule">Schedule</Link>
              <Link className="rounded-lg border px-4 py-2" href="/admin/faculty-dashboard">Faculty Dashboard</Link>
            </>
          )}

          {role === "COORDINATOR" && (
            <>
              <Link className="rounded-lg border px-4 py-2" href="/admin/imports">Transcript & Registration Import</Link>
              <Link className="rounded-lg border px-4 py-2" href="/admin/offerings">Offerings</Link>
              <Link className="rounded-lg border px-4 py-2" href="/admin/schedule">Schedule</Link>
              <Link className="rounded-lg border px-4 py-2" href="/admin/faculty-dashboard">Faculty Dashboard</Link>
            </>
          )}

          {role === "FACULTY" && (
            <>
              <Link className="rounded-lg border px-4 py-2" href="/admin/faculty-dashboard">My Routine & Load</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
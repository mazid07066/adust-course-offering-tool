import { requireStudentSession } from "@/lib/student-session";
import StudentDashboardClient from "./page-client";

export default async function StudentDashboardPage() {
  const session = await requireStudentSession();

  return <StudentDashboardClient session={session} />;
}
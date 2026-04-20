import { redirect } from "next/navigation";
import { requireFaculty } from "@/lib/auth-guard";

export default async function FacultyPage() {
  await requireFaculty();
  redirect("/faculty/course-choice");
}
import { requireFaculty } from "@/lib/auth-guard";
import FacultyCourseChoicePageClient from "./page-client";

export default async function FacultyCourseChoicePage() {
  await requireFaculty();
  return <FacultyCourseChoicePageClient />;
}
import { Suspense } from "react";
import CoOfferingDecisionCenterClient from "./page-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CoOfferingDecisionCenterClient />
    </Suspense>
  );
}
import { Suspense } from "react";
import CoOfferingSetupPageClient from "./page-client";

export default function CoOfferingSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 p-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Loading co-offering setup...
          </div>
        </div>
      }
    >
      <CoOfferingSetupPageClient />
    </Suspense>
  );
}
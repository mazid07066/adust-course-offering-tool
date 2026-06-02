import { Suspense } from "react";
import StudentLoginPageClient from "./page-client";

export default function StudentLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-100 px-4 py-10">
          <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-center text-sm text-slate-600">
              Loading student login...
            </p>
          </div>
        </main>
      }
    >
      <StudentLoginPageClient />
    </Suspense>
  );
}
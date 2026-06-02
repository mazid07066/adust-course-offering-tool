"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function StudentLoginPageClient() {
  const searchParams = useSearchParams();
  const portalClosed = searchParams.get("portal") === "closed";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    portalClosed
      ? "Student portal is currently closed. Please contact the department office."
      : ""
  );

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/student-auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Login failed.");
      }

      window.location.href = "/student/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
            UniFlow Academic Planner
          </p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Student Portal Login
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Use your student ID or linked email address to access your portal.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Student ID or Email
            </label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
              placeholder="Example: 232-0274-218"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          Registration, billing, attendance, grades, admit cards, and results are
          not active in this checkpoint. This portal is currently for verified
          student profile access only.
        </div>
      </div>
    </main>
  );
}
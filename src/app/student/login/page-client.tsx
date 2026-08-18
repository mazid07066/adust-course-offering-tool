"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import UniFlowLogo from "@/components/uniflow-logo";

export default function StudentLoginPageClient() {
  const searchParams =
    useSearchParams();

  const portalClosed =
    searchParams.get("portal") ===
    "closed";

  const [identifier, setIdentifier] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState(
      portalClosed
        ? "Student portal is currently closed. Please contact the department office."
        : ""
    );

  async function handleLogin(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const res =
        await fetch(
          "/api/student-auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              identifier,
              password,
            }),
          }
        );

      const json =
        await res.json();

      if (!res.ok) {
        throw new Error(
          json.error ||
            "Login failed."
        );
      }

      window.location.href =
        "/student/dashboard";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#071b3c] px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#0867b2]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-[-5rem] h-96 w-96 rounded-full bg-[#079db8]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[20%] top-[18%] h-40 w-40 rounded-full bg-[#4dc21f]/10 blur-3xl" />

      <div className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-8 shadow-2xl sm:p-10">
        <div className="flex justify-center">
          <UniFlowLogo />
        </div>

        <div className="mt-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#079db8]">
            Student Access
          </p>

          <h1 className="mt-3 text-2xl font-black text-[#071b3c]">
            Student Portal Login
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use your student ID or linked
            email address to access your
            academic portal.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleLogin}
          className="mt-7 space-y-5"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Student ID or Email
            </label>

            <input
              value={identifier}
              onChange={(e) =>
                setIdentifier(
                  e.target.value
                )
              }
              className="w-full rounded-xl border px-4 py-3"
              placeholder="Example: 232-0274-218"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              className="w-full rounded-xl border px-4 py-3"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0867b2] px-5 py-3 font-bold text-white shadow-sm transition hover:bg-[#075491] focus:ring-4 focus:ring-[#079db8]/20 disabled:opacity-60"
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-[#079db8]/15 bg-[#eafafb] p-4 text-xs leading-5 text-slate-600">
          Verified students can access
          their academic identity and
          authorized student services
          through UniFlow.
        </div>
      </div>
    </main>
  );
}

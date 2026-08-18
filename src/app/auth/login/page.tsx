"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import UniFlowLogo from "@/components/uniflow-logo";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Login failed."
        );

        return;
      }

      if (data.role === "FACULTY") {
        router.push(
          "/faculty/dashboard"
        );

        return;
      }

      router.push("/admin");
    } catch {
      setError(
        "Network error. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061a39] px-4 py-10">
      {/* Background atmosphere */}
      <div className="pointer-events-none absolute -left-32 -top-28 h-[28rem] w-[28rem] rounded-full bg-[#0867b2]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-[-7rem] h-[34rem] w-[34rem] rounded-full bg-[#079db8]/18 blur-3xl" />
      <div className="pointer-events-none absolute right-[18%] top-[10%] h-64 w-64 rounded-full bg-[#4dc21f]/10 blur-3xl" />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_32px_90px_rgba(0,0,0,0.28)] lg:grid-cols-[1.02fr_0.98fr]">
        {/* LEFT PRODUCT PANEL */}
        <section className="relative hidden min-h-[680px] overflow-hidden bg-gradient-to-br from-[#071b3c] via-[#08386d] to-[#075d82] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          {/* Decorative gradients */}
          <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-[#0867b2]/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-[-4rem] h-72 w-72 rounded-full bg-[#079db8]/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-24 left-1/3 h-40 w-40 rounded-full bg-[#4dc21f]/12 blur-3xl" />

          <div className="relative">
            <UniFlowLogo darkSurface />

            <div className="mt-10 max-w-md">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
                Integrated Academic Operations
              </p>

              <h1 className="mt-4 text-3xl font-black leading-snug tracking-tight text-white xl:text-[2.15rem]">
                Academic planning,
                administration, and
                scheduling in one platform.
              </h1>

              <p className="mt-5 max-w-lg text-[15px] leading-7 text-cyan-50/80">
                UniFlow connects course
                offering, faculty workload,
                scheduling, student
                administration, reporting,
                and institutional academic
                workflows through one
                coordinated digital
                environment.
              </p>
            </div>

          </div>

          <div className="relative">
            <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
              <p className="text-xs font-medium leading-5 text-cyan-50/65">
                Built to keep academic operations clear, coordinated, and easy to manage.
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT LOGIN PANEL */}
        <section className="flex min-h-[680px] items-center bg-white p-7 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            {/* Mobile branding */}
            <div className="mb-8 flex justify-center lg:hidden">
              <UniFlowLogo />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#079db8]">
                Secure Access
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#071b3c]">
                Welcome to UniFlow
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in to access your
                authorized academic
                workspace.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="mt-8 space-y-5"
            >
              <div>
                <label
                  htmlFor="username"
                  className="text-sm font-semibold text-slate-700"
                >
                  Username
                </label>

                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>

                  <Link
                    href="/auth/forgot-password"
                    className="text-sm font-semibold text-[#0867b2] transition hover:text-[#079db8] hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#0867b2] py-3 font-bold text-white shadow-[0_8px_20px_rgba(8,103,178,0.18)] transition hover:bg-[#075491] focus:outline-none focus:ring-4 focus:ring-[#079db8]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Signing in..."
                  : "Sign In"}
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-[#079db8]/20 bg-[#eafafb] px-4 py-4">
              <p className="text-xs leading-5 text-slate-600">
                Faculty members continue to
                use their established
                UniFlow username. Registered
                email addresses are used
                for secure password
                recovery.
              </p>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />

              <div className="h-2 w-2 rounded-full bg-[#0867b2]" />
              <div className="h-2 w-2 rounded-full bg-[#079db8]" />
              <div className="h-2 w-2 rounded-full bg-[#4dc21f]" />

              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              UniFlow Academic Planner ·
              Secure Academic Workflow
              Platform
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
